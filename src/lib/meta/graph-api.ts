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
    /** Explicação em linguagem de gente — quase sempre é aqui que a Meta diz
     * o que de fato está errado ("Invalid parameter" sozinho não ajuda). */
    error_user_title?: string;
    error_user_msg?: string;
    error_data?: { details?: string };
  };
};

/** Junta o que a Meta espalha em três campos numa frase só. */
function graphErrorMessage(status: number, payload: GraphErrorPayload): string {
  const error = payload.error;
  const base = error?.message ?? `Meta Graph API error (${status})`;
  const detail = error?.error_user_msg ?? error?.error_data?.details;
  if (!detail) return base;
  // "Invalid parameter" + "O anexo do cabeçalho não é válido", por exemplo.
  return `${base} — ${detail}`;
}

export class GraphApiError extends Error {
  readonly status: number;
  readonly payload: GraphErrorPayload;

  constructor(status: number, payload: GraphErrorPayload) {
    super(graphErrorMessage(status, payload));
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

/**
 * A Meta aceita no máximo 10 `template_ids` por chamada de analytics. Passar
 * 11 devolve 400 com a mensagem "template_ids" e nada mais — foi o que fazia
 * a conta com 42 modelos ficar com todos os números zerados.
 */
const ANALYTICS_IDS_PER_CALL = 10;

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

  const chunks: string[][] = [];
  for (let i = 0; i < templateMetaIds.length; i += ANALYTICS_IDS_PER_CALL) {
    chunks.push(templateMetaIds.slice(i, i + ANALYTICS_IDS_PER_CALL));
  }

  // Um lote que falhe não pode zerar os outros: cada um tem seu try.
  const responses = await Promise.all(
    chunks.map(async (ids) => {
      try {
        return await request<TemplateAnalyticsRawResponse>(`/${wabaId}/template_analytics`, {
          method: "GET",
          token,
          query: {
            start: String(startUnix),
            end: String(endUnix),
            granularity: "DAILY",
            template_ids: JSON.stringify(ids),
            metric_types: JSON.stringify(["sent", "delivered", "read", "clicked"]),
          },
        });
      } catch (err) {
        console.warn(`[getTemplateAnalytics] falhou pra WABA ${wabaId}`, err);
        return null;
      }
    }),
  );

  for (const data of responses) {
    for (const series of data?.data ?? []) {
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
  /** COPY_CODE não leva texto: o WhatsApp escreve "Copiar código" sozinho. */
  text?: string;
  url?: string;
  phone_number?: string;
  /** Lista no botão de link; texto puro no COPY_CODE — é assim que a Meta
   * espera em cada um, e mandar o formato do outro dá "Invalid parameter". */
  example?: string[] | string;
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

/**
 * Mensagem com botões de resposta. Até 3 a Meta entrega como botões; acima
 * disso só como lista, que é uma estrutura diferente (`sendListMessage`).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-interactive
 */
export async function sendInteractiveButtons(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  body: string;
  header?: string | null;
  footer?: string | null;
  buttons: { id: string; title: string }[];
}): Promise<{ messageId: string; waId: string | null }> {
  const data = await request<SendTemplateResponse & { contacts?: { wa_id?: string }[] }>(
    `/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      token: params.token,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "interactive",
        interactive: {
          type: "button",
          ...(params.header ? { header: { type: "text", text: params.header } } : {}),
          body: { text: params.body },
          ...(params.footer ? { footer: { text: params.footer } } : {}),
          action: {
            buttons: params.buttons.slice(0, 3).map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
          },
        },
      }),
    },
  );

  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    throw new GraphApiError(500, { error: { message: "Resposta sem message id" } });
  }
  return { messageId, waId: data.contacts?.[0]?.wa_id ?? null };
}

/** Mensagem com lista de opções — o caminho pra mais de 3 respostas. */
export async function sendListMessage(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  body: string;
  header?: string | null;
  footer?: string | null;
  buttonLabel: string;
  rows: { id: string; title: string }[];
}): Promise<{ messageId: string; waId: string | null }> {
  const data = await request<SendTemplateResponse & { contacts?: { wa_id?: string }[] }>(
    `/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      token: params.token,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "interactive",
        interactive: {
          type: "list",
          ...(params.header ? { header: { type: "text", text: params.header } } : {}),
          body: { text: params.body },
          ...(params.footer ? { footer: { text: params.footer } } : {}),
          action: {
            button: (params.buttonLabel || "Ver opções").slice(0, 20),
            sections: [
              {
                title: "Opções",
                rows: params.rows.slice(0, 10).map((r) => ({
                  id: r.id,
                  title: r.title.slice(0, 24),
                })),
              },
            ],
          },
        },
      }),
    },
  );

  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    throw new GraphApiError(500, { error: { message: "Resposta sem message id" } });
  }
  return { messageId, waId: data.contacts?.[0]?.wa_id ?? null };
}

/**
 * Mensagem com botão de link (cta_url). A Meta entrega esse botão sozinho — ele
 * não convive com resposta rápida na mesma mensagem, e não gera resposta.
 */
export async function sendCtaUrlMessage(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  body: string;
  header?: string | null;
  footer?: string | null;
  displayText: string;
  url: string;
}): Promise<{ messageId: string; waId: string | null }> {
  const data = await request<SendTemplateResponse & { contacts?: { wa_id?: string }[] }>(
    `/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      token: params.token,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "interactive",
        interactive: {
          type: "cta_url",
          ...(params.header ? { header: { type: "text", text: params.header } } : {}),
          body: { text: params.body },
          ...(params.footer ? { footer: { text: params.footer } } : {}),
          action: {
            name: "cta_url",
            parameters: {
              display_text: params.displayText.slice(0, 20),
              url: params.url,
            },
          },
        },
      }),
    },
  );

  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    throw new GraphApiError(500, { error: { message: "Resposta sem message id" } });
  }
  return { messageId, waId: data.contacts?.[0]?.wa_id ?? null };
}

/** Imagem, vídeo ou documento por link público. */
export async function sendMediaMessage(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  kind: "image" | "video" | "document";
  link: string;
  caption?: string | null;
  filename?: string | null;
}): Promise<{ messageId: string; waId: string | null }> {
  const media: Record<string, unknown> = { link: params.link };
  if (params.caption) media.caption = params.caption;
  if (params.kind === "document" && params.filename) media.filename = params.filename;

  const data = await request<SendTemplateResponse & { contacts?: { wa_id?: string }[] }>(
    `/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      token: params.token,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: params.kind,
        [params.kind]: media,
      }),
    },
  );

  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    throw new GraphApiError(500, { error: { message: "Resposta sem message id" } });
  }
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

// ----------------------------------------------------------------------------
// Criação de template de mensagem.
// Docs: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
//
// O template nasce PENDING e a Meta revisa (normalmente até 24h). Cabeçalho de
// mídia não manda o arquivo: manda um `header_handle` obtido antes na Resumable
// Upload API (`uploadTemplateHeaderHandle`).
// ----------------------------------------------------------------------------
/** Exemplo de variável nomeada (`{{nome}}`), exigido quando o template usa
 * `parameter_format: "NAMED"`. */
export type NamedParamExample = { param_name: string; example: string };

export type CreateTemplateComponent =
  | {
      type: "HEADER";
      format: "TEXT";
      text: string;
      example?: { header_text?: string[]; header_text_named_params?: NamedParamExample[] };
    }
  | {
      type: "HEADER";
      format: "IMAGE" | "VIDEO" | "DOCUMENT";
      example: { header_handle: string[] };
    }
  | {
      type: "BODY";
      text: string;
      example?: { body_text?: string[][]; body_text_named_params?: NamedParamExample[] };
    }
  | { type: "FOOTER"; text: string }
  | { type: "BUTTONS"; buttons: MetaTemplateButton[] };

export type CreateTemplateParams = {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  /** POSITIONAL (`{{1}}`) é o padrão da Meta; NAMED (`{{nome}}`) precisa ser
   * declarado e muda o formato dos exemplos. */
  parameter_format?: "POSITIONAL" | "NAMED";
  components: CreateTemplateComponent[];
};

export type CreateTemplateResult = {
  id: string;
  status: string;
  category: string;
};

export async function createTemplate(
  wabaId: string,
  token: string,
  params: CreateTemplateParams,
): Promise<CreateTemplateResult> {
  return request<CreateTemplateResult>(`/${wabaId}/message_templates`, {
    method: "POST",
    token,
    body: JSON.stringify(params),
  });
}

/**
 * Apaga um template da WABA. A Meta apaga por nome (todos os idiomas) ou por
 * `hsm_id` + nome (só aquele idioma).
 */
export async function deleteTemplate(
  wabaId: string,
  token: string,
  name: string,
  metaTemplateId?: string,
): Promise<void> {
  const query: Record<string, string> = { name };
  if (metaTemplateId) query.hsm_id = metaTemplateId;
  await request(`/${wabaId}/message_templates`, { method: "DELETE", token, query });
}

/**
 * Sobe o arquivo do cabeçalho de mídia e devolve o `header_handle`.
 *
 * É a Resumable Upload API do app (não a mídia da Cloud API, que é por número
 * e serve pra enviar mensagem): cria a sessão em `/{app_id}/uploads` e manda os
 * bytes em `/{upload_session_id}` com `file_offset: 0`. O handle devolvido só
 * vale pra criação de template.
 */
export async function uploadTemplateHeaderHandle(params: {
  token: string;
  file: File;
}): Promise<string> {
  const { token, file } = params;
  if (!serverEnv.META_APP_ID) {
    throw new Error("META_APP_ID ausente no .env.local");
  }

  const session = await request<{ id: string }>(`/${serverEnv.META_APP_ID}/uploads`, {
    method: "POST",
    token,
    query: {
      file_length: String(file.size),
      file_type: file.type,
    },
  });

  // O upload em si não passa pelo `request()`: o corpo são bytes crus e o
  // header de autorização usa o formato `OAuth <token>` exigido aqui.
  const res = await fetch(graphUrl(`/${session.id}`), {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      file_offset: "0",
      "Content-Type": "application/octet-stream",
    },
    body: await file.arrayBuffer(),
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

  const { h } = (await res.json()) as { h?: string };
  if (!h) throw new Error("Upload sem handle na resposta da Meta");
  return h;
}

export { extractPlaceholders } from "./placeholders";
