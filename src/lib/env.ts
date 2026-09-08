function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export const serverEnv = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  META_APP_ID: process.env.META_APP_ID,
  META_APP_SECRET: process.env.META_APP_SECRET,
  META_EMBEDDED_SIGNUP_CONFIG_ID: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID,
  META_COEXISTENCE_CONFIG_ID: process.env.META_COEXISTENCE_CONFIG_ID,
  META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION ?? "v21.0",
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
  // URL antiga que já recebia os webhooks da Meta (ex: automação em n8n) —
  // opcional. Se setada, /api/webhooks/meta repassa cada evento pra ela
  // também, além de processar pro dispatcher, pra não quebrar quem já
  // dependia dela quando trocamos a Callback URL do app na Meta.
  META_WEBHOOK_FORWARD_URL: process.env.META_WEBHOOK_FORWARD_URL,
};
