"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugifyWithSuffix } from "@/lib/slug";
import { env } from "@/lib/env";
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  removeMemberSchema,
  updateWorkspaceSchema,
} from "@/features/workspace/schemas";
import { ACTIVE_WORKSPACE_COOKIE } from "@/server/workspace";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createWorkspaceAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createWorkspaceSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos",
      fieldErrors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""]),
      ),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Não autenticado" };
  }

  // Usa admin client (service_role) pra contornar limitação do RLS em
  // server actions com @supabase/ssr — o JWT do usuário nem sempre chega
  // ao PostgREST corretamente. Segurança garantida pelo getUser() acima.
  const admin = createAdminClient();
  const { data: workspace, error } = await admin
    .from("workspace")
    .insert({
      name: parsed.data.name,
      slug: slugifyWithSuffix(parsed.data.name),
      owner_id: user.id,
    })
    .select()
    .single();

  if (error || !workspace) {
    return { ok: false, error: error?.message ?? "Falha ao criar workspace" };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function updateWorkspaceAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateWorkspaceSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Não autenticado" };
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("workspace_member")
    .select("role")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || membership.role !== "owner") {
    return { ok: false, error: "Apenas owners podem editar o workspace" };
  }

  const { error } = await admin
    .from("workspace")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.workspaceId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/configuracoes");
  return { ok: true, data: undefined };
}

export async function switchWorkspaceAction(workspaceId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("workspace_member")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}

export async function inviteMemberAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = inviteMemberSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos",
      fieldErrors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""]),
      ),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Não autenticado" };
  }

  const admin = createAdminClient();
  const { data: requester } = await admin
    .from("workspace_member")
    .select("role")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!requester || requester.role !== "owner") {
    return { ok: false, error: "Apenas owners podem convidar membros" };
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/aceitar-convite` },
  );

  if (inviteError || !invited.user) {
    return { ok: false, error: inviteError?.message ?? "Falha ao convidar" };
  }

  const { error: memberError } = await admin
    .from("workspace_member")
    .insert({
      workspace_id: parsed.data.workspaceId,
      user_id: invited.user.id,
      role: "member",
    });

  if (memberError && memberError.code !== "23505") {
    return { ok: false, error: memberError.message };
  }

  revalidatePath("/configuracoes");
  return { ok: true, data: undefined };
}

export async function removeMemberAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = removeMemberSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Não autenticado" };
  }
  if (user.id === parsed.data.userId) {
    return { ok: false, error: "Você não pode remover a si mesmo" };
  }

  const admin = createAdminClient();
  const { data: requester } = await admin
    .from("workspace_member")
    .select("role")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!requester || requester.role !== "owner") {
    return { ok: false, error: "Apenas owners podem remover membros" };
  }

  const { error } = await admin
    .from("workspace_member")
    .delete()
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", parsed.data.userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/configuracoes");
  return { ok: true, data: undefined };
}
