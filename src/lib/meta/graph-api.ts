import "server-only";

import { serverEnv } from "@/lib/env";

const GRAPH_BASE = "https://graph.facebook.com";

function apiVersion(): string {
  return serverEnv.META_GRAPH_API_VERSION;
}

function graphUrl(path: string): string {
  const v = apiVersion();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${GRAPH_BASE}/${v}${p}`;
}

type GraphErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export class GraphApiError extends Error {
  readonly status: number;
  readonly payload: GraphErrorPayload;

  constructor(status: number, payload: GraphErrorPayload) {
    super(payload.error?.message ?? `Meta Graph API error (${status})`);
    this.status = status;
    this.payload = payload;
    this.name = "GraphApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string; query?: Record<string, string> } = {},
): Promise<T> {
  const { token, query, headers, ...rest } = init;

  const url = new URL(graphUrl(path));
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let payload: GraphErrorPayload = {};
    try {
      payload = (await res.json()) as GraphErrorPayload;
    } catch {
      // ignored
    }
    throw new GraphApiError(res.status, payload);
  }

  return (await res.json()) as T;
}

// ----------------------------------------------------------------------------
// OAuth: troca código do Embedded Signup por access token de longa duração.
// Docs: https://developers.facebook.com/docs/whatsapp/embedded-signup/steps/exchange-code
// ----------------------------------------------------------------------------
type ExchangeCodeResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

export async function exchangeCodeForToken(code: string): Promise<string> {
  if (!serverEnv.META_APP_ID || !serverEnv.META_APP_SECRET) {
    throw new Error("META_APP_ID/META_APP_SECRET ausentes no .env.local");
  }

  const data = await request<ExchangeCodeResponse>("/oauth/access_token", {
    method: "GET",
    query: {
      client_id: serverEnv.META_APP_ID,
      client_secret: serverEnv.META_APP_SECRET,
      code,
    },
  });

  return data.access_token;
}

// ----------------------------------------------------------------------------
// Info do business associado ao WABA.
// ----------------------------------------------------------------------------
type WabaInfo = {
  id: string;
  name?: string;
  owner_business_info?: { id: string; name: string };
};

export async function getWabaInfo(wabaId: string, token: string): Promise<WabaInfo> {
  return request<WabaInfo>(`/${wabaId}`, {
    method: "GET",
    token,
    query: {
      fields: "id,name,owner_business_info",
    },
  });
}

// ----------------------------------------------------------------------------
// Health Status da WABA — mostra o motivo real por trás de bloqueios de envio
// (billing, banimento, verificação de negócio pendente) que os erros de envio
// sozinhos não explicam (ex.: "Business eligibility payment issue").
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/health-status
// ----------------------------------------------------------------------------
export type WabaHealthError = {
  error_code?: number;
  error_description?: string;
  possible_solution?: string;
};

export type WabaHealthEntity = {
  entity_type?: "APP" | "WABA" | "PHONE_NUMBER" | string;
  id?: string;
  can_send_message?: "AVAILABLE" | "LIMITED" | "BLOCKED" | string;
  errors?: WabaHealthError[];
};

export type WabaHealthStatus = {
  can_send_message?: "AVAILABLE" | "LIMITED" | "BLOCKED" | string;
  entities?: WabaHealthEntity[];
};

// Best-effort: alguns tokens/versões de API não têm permissão pra esse campo.
// Não deve derrubar o sync inteiro se falhar.
export async function getWabaHealthStatus(
  wabaId: string,
  token: string,
): Promise<WabaHealthStatus | null> {
  try {
    const data = await request<{ health_status?: WabaHealthStatus }>(`/${wabaId}`, {
      method: "GET",
      token,
      query: { fields: "health_status" },
    });
    return data.health_status ?? null;
  } catch (err) {
    console.warn(`[getWabaHealthStatus] falhou pra ${wabaId}`, err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// Lista phone numbers do WABA.
// ----------------------------------------------------------------------------
export type PhoneNumberInfo = {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  is_pin_enabled?: boolean;
  messaging_limit_tier?: string;
  throughput?: { level?: string };
  /** CONNECTED | PENDING | FLAGGED | RESTRICTED … */
  status?: string;
  /** CLOUD_API | ON_PREMISE | NOT_APPLICABLE */
  platform_type?: string;
  /** true = número em Coexistência (segue no app e na Cloud API). */
  is_on_biz_app?: boolean;
};

type PhoneNumbersResponse = {
  data: PhoneNumberInfo[];
};

// Em 2026 Meta deprecou `messaging_limit_tier` (per-phone) e movou pra
// `whatsapp_business_manager_messaging_limit` (per portfolio, compartilhado
// entre todos os números). Listing /phone_numbers não expõe — precisa hit
// individual em /{phone_number_id}. Mantemos fallback no field antigo pra
// contas em versões anteriores da Graph API.
// Docs: https://developers.facebook.com/docs/whatsapp/messaging-limits/
type PhoneNumberDetails = {
  tier?: string;
  status?: string;
  platformType?: string;
  isOnBizApp?: boolean;
};

const BASE_DETAIL_FIELDS = "whatsapp_business_manager_messaging_limit,messaging_limit_tier";
// `status`, `platform_type` e `is_on_biz_app` não vêm pela borda
// /{waba}/phone_numbers — só no nó do número. É `is_on_biz_app` que confirma
// Coexistência; sem ele a tela caía na nossa flag `is_registered`, que a Meta
// nunca liga pra número de app.
const STATE_DETAIL_FIELDS = "status,platform_type,is_on_biz_app";

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

async function getPhoneNumberDetails(
  phoneNumberId: string,
  token: string,
): Promise<PhoneNumberDetails> {
  async function fetchFields(fields: string) {
    return request<Record<string, unknown>>(`/${phoneNumberId}`, {
      method: "GET",
      token,
      query: { fields },
    });
  }

  let data: Record<string, unknown>;
  try {
    data = await fetchFields(`${BASE_DETAIL_FIELDS},${STATE_DETAIL_FIELDS}`);
  } catch (err) {
    // Se a Graph recusar algum dos campos de estado, não vale perder o tier
    // junto — repete só com os campos que já funcionavam.
    console.warn(
      `[getPhoneNumberDetails] campos de estado recusados pro ${phoneNumberId}, tentando sem eles`,
      err,
    );
    try {
      data = await fetchFields(BASE_DETAIL_FIELDS);
    } catch (err2) {
      console.warn(`[getPhoneNumberDetails] falhou pro ${phoneNumberId}`, err2);
      return {};
    }
  }

  const details = {
    tier:
      pickString(data.whatsapp_business_manager_messaging_limit) ??
      pickString(data.messaging_limit_tier),
    status: pickString(data.status),
    platformType: pickString(data.platform_type),
    isOnBizApp: typeof data.is_on_biz_app === "boolean" ? data.is_on_biz_app : undefined,
  };

  // Registra o que a Meta devolveu de fato. Sem isso, um campo ausente é
  // indistinguível de um campo vazio, e a tela mente sem deixar rastro.
  console.warn(
    `[getPhoneNumberDetails] ${phoneNumberId} status=${details.status ?? "ausente"} ` +
      `platform_type=${details.platformType ?? "ausente"} ` +
      `is_on_biz_app=${details.isOnBizApp ?? "ausente"} ` +
      `chaves=${Object.keys(data).join("|")}`,
  );

  return details;
}

export async function listPhoneNumbers(
  wabaId: string,
  token: string,
): Promise<PhoneNumberInfo[]> {
  const data = await request<PhoneNumbersResponse>(`/${wabaId}/phone_numbers`, {
    method: "GET",
    token,
    query: {
      fields:
        "id,display_phone_number,verified_name,quality_rating,code_verification_status,is_pin_enabled,throughput",
    },
  });

  const phones = data.data ?? [];
  // Enriquece cada número com o que só existe no nó individual: limite de
  // mensagens e o estado real (status / platform_type / is_on_biz_app).
  const enriched = await Promise.all(
    phones.map(async (p) => {
      const details = await getPhoneNumberDetails(p.id, token);
      return {
        ...p,
        messaging_limit_tier: details.tier,
        status: details.status,
        platform_type: details.platformType,
        is_on_biz_app: details.isOnBizApp,
      };
    }),
  );
  return enriched;
}

// ----------------------------------------------------------------------------
// Analytics por template (sent/delivered/read/clicked) direto da Graph API —
// não depende do nosso tracking local, então cobre também mensagens mandadas
// fora do dispatcher (ex.: outra ferramenta usando a mesma WABA).
// Docs: https://developers.facebook.com/docs/whatsapp/business-management-api/template-analytics
// ----------------------------------------------------------------------------
export type TemplateAnalyticsPoint = {
  templateId: string;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
};

type TemplateAnalyticsRawClicked = { type?: string; button_content?: string; count?: number };
type TemplateAnalyticsRawDataPoint = {
  template_id?: string;
  sent?: number;
  delivered?: number;
  read?: number;
  clicked?: TemplateAnalyticsRawClicked[];
};
type TemplateAnalyticsRawResponse = {
  data?: { data_points?: TemplateAnalyticsRawDataPoint[] }[];
};

// Best-effort — agrega por template_id somando os data_points diários do
// período. Retorna mapa vazio (não lança) se a Meta recusar/mudar o formato.
export async function getTemplateAnalytics(
  wabaId: string,
  token: string,
  templateMetaIds: string[],
  startUnix: number,
  endUnix: number,
): Promise<Map<string, TemplateAnalyticsPoint>> {
  const out = new Map<string, TemplateAnalyticsPoint>();
  if (templateMetaIds.length === 0) return out;

  try {
    const data = await request<TemplateAnalyticsRawResponse>(`/${wabaId}/template_analytics`, {
      method: "GET",
      token,
      query: {
        start: String(startUnix),
        end: String(endUnix),
        granularity: "DAILY",
        template_ids: JSON.stringify(templateMetaIds),
        metric_types: JSON.stringify(["sent", "delivered", "read", "clicked"]),
      },
    });

    for (const series of data.data ?? []) {
      for (const point of series.data_points ?? []) {
        if (!point.template_id) continue;
        const clickedCount = (point.clicked ?? []).reduce((acc, c) => acc + (c.count ?? 0), 0);
        const existing = out.get(point.template_id) ?? {
          templateId: point.template_id,
          sent: 0,
          delivered: 0,
          read: 0,
          clicked: 0,
        };
        existing.sent += point.sent ?? 0;
        existing.delivered += point.delivered ?? 0;
        existing.read += point.read ?? 0;
        existing.clicked += clickedCount;
        out.set(point.template_id, existing);
      }
    }
  } catch (err) {
    console.warn(`[getTemplateAnalytics] falhou pra WABA ${wabaId}`, err);
  }

  return out;
}

// ----------------------------------------------------------------------------
// Custo/volume de conversas do WABA no período (o "Valor gasto" do WhatsApp
// Manager). Sintaxe de edge com parâmetros embutidos no próprio `fields`.
// Docs: https://developers.facebook.com/docs/whatsapp/business-management-api/analytics/conversation-analytics
// ----------------------------------------------------------------------------
export type ConversationCostSummary = {
  totalConversations: number;
  totalCost: number;
  currency: string | null;
};

type ConversationAnalyticsRawDataPoint = {
  conversation?: number;
  cost?: number;
};
type ConversationAnalyticsRawResponse = {
  conversation_analytics?: { data?: { data_points?: ConversationAnalyticsRawDataPoint[] }[] };
};

// Best-effort — soma custo/conversas de todos os data_points do período.
// Não lança: token sem permissão pra esse campo, ou formato mudando de versão
// pra versão da Graph API, não deve derrubar a tela de conexão.
export async function getConversationCostSummary(
  wabaId: string,
  token: string,
  startUnix: number,
  endUnix: number,
): Promise<ConversationCostSummary | null> {
  try {
    const fields =
      `conversation_analytics.start(${startUnix}).end(${endUnix}).granularity(MONTHLY)` +
      `.dimensions(["conversation_category"])`;
    const data = await request<ConversationAnalyticsRawResponse>(`/${wabaId}`, {
      method: "GET",
      token,
      query: { fields },
    });

    const points = data.conversation_analytics?.data?.flatMap((d) => d.data_points ?? []) ?? [];
    if (points.length === 0) return null;

    const totals = points.reduce(
      (acc, p) => {
        acc.totalConversations += p.conversation ?? 0;
        acc.totalCost += p.cost ?? 0;
        return acc;
      },
      { totalConversations: 0, totalCost: 0 },
    );

    // A Meta fatura conversas em USD por padrão nesse endpoint — ajustar aqui
    // se o payload real trouxer campo de moeda explícito.
    return { ...totals, currency: "USD" };
  } catch (err) {
    console.warn(`[getConversationCostSummary] falhou pra WABA ${wabaId}`, err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// Subscreve o app ao WABA pra receber webhooks.
// ----------------------------------------------------------------------------
export async function subscribeAppToWaba(wabaId: string, token: string): Promise<void> {
  await request<{ success: boolean }>(`/${wabaId}/subscribed_apps`, {
    method: "POST",
    token,
  });
}

// ----------------------------------------------------------------------------
// Registra o número na Cloud API. Passo crítico da Coexistência: sem ele a
// Meta pode devolver "The account is not registered" ao tentar enviar
// mensagem, mesmo depois do Embedded Signup ter concluído com sucesso (o
// registro automático da Meta pelo popup às vezes falha silenciosamente).
// Não lança em erro — o chamador decide se bloqueia o fluxo (um número já
// registrado também devolve erro aqui, e isso é esperado).
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration
// ----------------------------------------------------------------------------
export type RegisterPhoneNumberResult = { ok: boolean; status: number; message?: string };

export async function registerPhoneNumber(
  phoneNumberId: string,
  token: string,
  pin: string,
): Promise<RegisterPhoneNumberResult> {
  try {
    await request<{ success: boolean }>(`/${phoneNumberId}/register`, {
      method: "POST",
      token,
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    });
    return { ok: true, status: 200 };
  } catch (err) {
    if (err instanceof GraphApiError) {
      return { ok: false, status: err.status, message: err.message };
    }
    throw err;
  }
}

// ----------------------------------------------------------------------------
// Upload de mídia pro header de template com format IMAGE. Reusar o link do
// exemplo aprovado (components_raw[].example.header_handle) como `image.link`
// não é confiável pra entrega — a mensagem é aceita (retorna message id) mas
// falha silenciosamente depois (sem webhook configurado, só descobrimos pelo
// "Mensagens entregues: 0" no WhatsApp Manager). Baixa a imagem e faz upload
// via Cloud API pra ter um media id próprio — o jeito suportado oficialmente.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
// ----------------------------------------------------------------------------
export async function uploadMediaFromUrl(
  phoneNumberId: string,
  token: string,
  sourceUrl: string,
): Promise<{ id: string }> {
  const imgRes = await fetch(sourceUrl);
  if (!imgRes.ok) {
    throw new GraphApiError(imgRes.status, {
      error: { message: `Falha baixando imagem de origem (${imgRes.status})` },
    });
  }
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
  const blob = await imgRes.blob();

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", contentType);
  form.append("file", blob, "header.jpg");

  const res = await fetch(graphUrl(`/${phoneNumberId}/media`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    cache: "no-store",
  });

  if (!res.ok) {
    let payload: GraphErrorPayload = {};
    try {
      payload = (await res.json()) as GraphErrorPayload;
    } catch {
      // ignored
    }
    throw new GraphApiError(res.status, payload);
  }

  const data = (await res.json()) as { id: string };
  return { id: data.id };
}

// ----------------------------------------------------------------------------
// Templates do WABA. Categoria e status são strings da Meta.
// ----------------------------------------------------------------------------
export type MetaTemplateButton = {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE" | string;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
};

export type MetaTemplateComponent = {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  buttons?: MetaTemplateButton[];
  example?: { header_text?: string[]; body_text?: string[][] };
};

export type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: MetaTemplateComponent[];
};

type TemplatesResponse = {
  data: MetaTemplate[];
  paging?: { cursors?: { after?: string }; next?: string };
};

export async function listTemplates(
  wabaId: string,
  token: string,
): Promise<MetaTemplate[]> {
  const out: MetaTemplate[] = [];
  let after: string | undefined;

  do {
    const query: Record<string, string> = {
      fields: "id,name,language,status,category,components",
      limit: "100",
    };
    if (after) query.after = after;

    const data = await request<TemplatesResponse>(`/${wabaId}/message_templates`, {
      method: "GET",
      token,
      query,
    });

    const batch = data.data ?? [];
    out.push(...batch);
    // Para se não voltou nada ou se Meta não indicou próxima página explícita.
    after = batch.length > 0 && data.paging?.next ? data.paging.cursors?.after : undefined;
  } while (after);

  return out;
}

// ----------------------------------------------------------------------------
// Envia template message via WhatsApp Cloud API.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
// ----------------------------------------------------------------------------
/**
 * Parâmetro de template. Se `name` presente, vai como `parameter_name`
 * (named params). Se ausente, vai posicional (ordem do array conta).
 */
export type TemplateParameter = { name?: string; text: string };

export type SendTemplateParams = {
  phoneNumberId: string;
  to: string;
  token: string;
  templateName: string;
  language: string;
  bodyParameters?: TemplateParameter[];
  headerParameters?: TemplateParameter[];
  // Usados quando o HEADER do template é format IMAGE (não tem placeholder
  // de texto, então headerParameters não se aplica). `headerImageId` (media
  // id já uploadado via Cloud API) tem prioridade — é o método suportado
  // oficialmente. `headerImageLink` é fallback (link público, menos confiável
  // pra entrega — a Meta pode não conseguir buscar todo link externo).
  headerImageId?: string;
  headerImageLink?: string;
  // Botão COPY_CODE ("Copiar código da oferta") — a Meta exige esse
  // componente em toda mensagem mesmo quando o código é fixo/aprovado no
  // template (não é injetado automaticamente). `index` é a posição do botão
  // no array `buttons` do template (0-based).
  copyCodeButton?: { index: number; code: string };
};

type SendTemplateResponse = {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
};

function renderParameter(p: TemplateParameter): Record<string, unknown> {
  if (p.name) return { type: "text", parameter_name: p.name, text: p.text };
  return { type: "text", text: p.text };
}

export async function sendTemplate(
  params: SendTemplateParams,
): Promise<{ messageId: string }> {
  const components: Record<string, unknown>[] = [];

  if (params.headerImageId) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { id: params.headerImageId } }],
    });
  } else if (params.headerImageLink) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: params.headerImageLink } }],
    });
  } else if (params.headerParameters && params.headerParameters.length > 0) {
    components.push({
      type: "header",
      parameters: params.headerParameters.map(renderParameter),
    });
  }

  if (params.bodyParameters && params.bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: params.bodyParameters.map(renderParameter),
    });
  }

  if (params.copyCodeButton) {
    components.push({
      type: "button",
      sub_type: "copy_code",
      index: String(params.copyCodeButton.index),
      parameters: [{ type: "coupon_code", coupon_code: params.copyCodeButton.code }],
    });
  }

  const body = {
    messaging_product: "whatsapp",
    to: params.to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.language },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  const data = await request<SendTemplateResponse>(`/${params.phoneNumberId}/messages`, {
    method: "POST",
    token: params.token,
    body: JSON.stringify(body),
  });

  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    throw new GraphApiError(500, { error: { message: "Resposta sem message id" } });
  }
  return { messageId };
}

// ----------------------------------------------------------------------------
// Mensagem de texto livre (fora de template).
//
// Só funciona dentro da janela de 24h aberta pelo contato. Fora dela a Meta
// responde 200 com message id e descarta a mensagem silenciosamente — quem
// chama precisa ter checado a janela antes.
// ----------------------------------------------------------------------------
export async function sendTextMessage(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  text: string;
}): Promise<{ messageId: string; waId: string | null }> {
  const data = await request<
    SendTemplateResponse & { contacts?: { wa_id?: string }[] }
  >(`/${params.phoneNumberId}/messages`, {
    method: "POST",
    token: params.token,
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.to,
      type: "text",
      text: { preview_url: true, body: params.text },
    }),
  });

  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    throw new GraphApiError(500, { error: { message: "Resposta sem message id" } });
  }
  // A Meta normaliza o número (no Brasil, o nono dígito entra ou sai). O
  // `wa_id` devolvido é a chave real da conversa — gravar o número digitado
  // criaria uma thread paralela que nunca casa com a do webhook.
  return { messageId, waId: data.contacts?.[0]?.wa_id ?? null };
}

/** Marca a mensagem como lida no WhatsApp do contato (os dois tiques azuis). */
export async function markMessageRead(params: {
  phoneNumberId: string;
  token: string;
  messageId: string;
}): Promise<void> {
  await request(`/${params.phoneNumberId}/messages`, {
    method: "POST",
    token: params.token,
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: params.messageId,
    }),
  });
}

/**
 * URL temporária de um arquivo recebido. A Meta não entrega o binário direto:
 * primeiro devolve uma URL, e essa URL ainda exige o token no header — por
 * isso o download precisa passar pelo servidor, nunca pelo navegador.
 */
export async function getMediaUrl(
  mediaId: string,
  token: string,
): Promise<{ url: string; mimeType: string | null }> {
  const data = await request<{ url?: string; mime_type?: string }>(`/${mediaId}`, {
    method: "GET",
    token,
  });
  if (!data.url) {
    throw new GraphApiError(404, { error: { message: "Mídia sem URL" } });
  }
  return { url: data.url, mimeType: data.mime_type ?? null };
}

export async function downloadMedia(
  url: string,
  token: string,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GraphApiError(res.status, { error: { message: "Falha baixando mídia" } });
  }
  return {
    body: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
  };
}

export { extractPlaceholders } from "./placeholders";
