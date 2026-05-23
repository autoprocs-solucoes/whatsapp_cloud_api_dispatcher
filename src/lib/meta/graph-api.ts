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
async function getPhoneNumberTier(
  phoneNumberId: string,
  token: string,
): Promise<string | undefined> {
  try {
    const data = await request<Record<string, unknown>>(`/${phoneNumberId}`, {
      method: "GET",
      token,
      query: {
        fields: "whatsapp_business_manager_messaging_limit,messaging_limit_tier",
      },
    });
    const next = data.whatsapp_business_manager_messaging_limit;
    if (typeof next === "string" && next) return next;
    const legacy = data.messaging_limit_tier;
    if (typeof legacy === "string" && legacy) return legacy;
    return undefined;
  } catch (err) {
    console.warn(`[getPhoneNumberTier] falhou pro ${phoneNumberId}`, err);
    return undefined;
  }
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
  // Enriquece cada número com messaging_limit_tier (chamada individual).
  const enriched = await Promise.all(
    phones.map(async (p) => ({
      ...p,
      messaging_limit_tier: await getPhoneNumberTier(p.id, token),
    })),
  );
  return enriched;
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

  if (params.headerParameters && params.headerParameters.length > 0) {
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

export { extractPlaceholders } from "./placeholders";
