"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { requireMasterUser } from "@/server/master";
import { ACTIVE_WORKSPACE_COOKIE } from "@/server/workspace";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const emailSchema = z.string().trim().toLowerCase().email();

/**
 * Dá acesso ao painel master pra um e-mail — convida (cria conta) se ainda
 * não existe, ou só marca `is_superadmin = true` se a pessoa já tem conta na
 * plataforma (ex: já é membro de algum workspace de cliente).
 */
export async function promoteMasterMemberAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await requireMasterUser();

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, error: "E-mail inválido" };
  }
  const email = parsed.data;

  const admin = createAdminClient();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/aceitar-convite`,
  });

  let userId = invited?.user?.id;

  if (!userId) {
    // Provavelmente já existe conta com esse e-mail — procura entre os
    // usuários (a API admin não tem filtro por e-mail, só paginação).
    let page = 1;
    const perPage = 200;
    for (let i = 0; i < 25 && !userId; i++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error || !data || data.users.length === 0) break;
      const found = data.users.find((u) => u.email?.toLowerCase() === email);
      if (found) userId = found.id;
      if (data.users.length < perPage) break;
      page++;
    }
  }

  if (!userId) {
    return { ok: false, error: inviteError?.message ?? "Não foi possível localizar ou convidar esse e-mail" };
  }

  const { error: updateError } = await admin
    .from("profile")
    .update({ is_superadmin: true })
    .eq("user_id", userId);
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/master/perfil");
  return { ok: true, data: undefined };
}

/**
 * "Entrar" num cliente a partir do Master: troca o workspace ativo do
 * próprio master pra esse cliente e manda pro dashboard normal — o menu
 * completo do cliente (Dashboard/Contatos/Segmentos/Templates/Transmissão/
 * Configurações) aparece porque é literalmente o app do cliente, não uma
 * página paralela. Garante membership como owner antes de trocar (o master
 * pode não ser membro de todo workspace ainda).
 */
export async function enterClientWorkspaceAction(formData: FormData): Promise<void> {
  const user = await requireMasterUser();

  const workspaceId = z.string().uuid().parse(formData.get("workspaceId"));

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("workspace_member")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    await admin
      .from("workspace_member")
      .insert({ workspace_id: workspaceId, user_id: user.id, role: "owner" });
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}

const demoteSchema = z.object({ userId: z.string().uuid() });

export async function demoteMasterMemberAction(input: unknown): Promise<ActionResult> {
  const currentUser = await requireMasterUser();

  const parsed = demoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  if (parsed.data.userId === currentUser.id) {
    return { ok: false, error: "Você não pode remover seu próprio acesso master" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profile")
    .update({ is_superadmin: false })
    .eq("user_id", parsed.data.userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/master/perfil");
  return { ok: true, data: undefined };
}
