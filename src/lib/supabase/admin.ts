import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env, serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Admin client — usa service_role. NUNCA importar em código client.
 * Bypassa RLS. Usar somente em server actions / route handlers para operações
 * privilegiadas (convidar usuários, etc).
 */
export function createAdminClient() {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin client");
  }
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
