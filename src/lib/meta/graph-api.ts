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
};

type PhoneNumbersResponse = {
  data: PhoneNumberInfo[];
};

export async function listPhoneNumbers(
  wabaId: string,
  token: string,
): Promise<PhoneNumberInfo[]> {
  const data = await request<PhoneNumbersResponse>(`/${wabaId}/phone_numbers`, {
    method: "GET",
    token,
    query: {
      fields:
        "id,display_phone_number,verified_name,quality_rating,code_verification_status,is_pin_enabled",
    },
  });
  return data.data ?? [];
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
