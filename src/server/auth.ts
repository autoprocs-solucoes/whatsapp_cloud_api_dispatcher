import "server-only";

import { cache } from "react";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/database.types";
import { getAuthUser } from "@/server/auth-user";

export type AuthenticatedUser = {
  id: string;
  email: string;
  profile: Profile;
};

/**
 * Retorna user autenticado + profile. null se não logado.
 * Usa admin pra ler profile (RLS server-side com @supabase/ssr não confiável).
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profile")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    profile,
  };
});

/**
 * Server-side: redireciona para /login se não autenticado.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
