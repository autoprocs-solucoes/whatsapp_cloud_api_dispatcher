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

/**
 * Apaga um cliente e tudo que é dele.
 *
 * O banco cascateia: contatos, segmentos, templates, fluxos, campanhas,
 * transmissões com o histórico de cada destinatário, conversas e a conexão com
 * a Meta somem junto. Não há lixeira — por isso a ação exige que quem está
 * apagando escreva o nome do cliente.
 *
 * O que NÃO é tocado: a conta das pessoas. Quem era membro continua existindo
 * e com acesso aos outros workspaces.
 */
export async function deleteClientWorkspaceAction(input: unknown): Promise<ActionResult> {
  const user = await requireMasterUser();

  const parsed = z
    .object({ workspaceId: z.string().uuid(), confirmName: z.string() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const admin = createAdminClient();
  const { data: workspace } = await admin
    .from("workspace")
    .select("id, name")
    .eq("id", parsed.data.workspaceId)
    .maybeSingle();
  if (!workspace) return { ok: false, error: "Cliente não encontrado" };

  const typed = parsed.data.confirmName.trim().toLowerCase();
  if (typed !== workspace.name.trim().toLowerCase()) {
    return { ok: false, error: "O nome digitado não confere com o do cliente" };
  }

  // Fica no log de quem apagou o quê: depois do delete não sobra evidência
  // nenhuma no banco.
  console.warn(
    "[master] apagando cliente",
    JSON.stringify({ workspace: workspace.name, id: workspace.id, by: user.id }),
  );

  const { error } = await admin.from("workspace").delete().eq("id", workspace.id);
  if (error) return { ok: false, error: error.message };

  // Se o master estava "dentro" desse cliente, o cookie ficaria apontando pra
  // um workspace que não existe mais.
  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value === workspace.id) {
    cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
  }

  revalidatePath("/master");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
