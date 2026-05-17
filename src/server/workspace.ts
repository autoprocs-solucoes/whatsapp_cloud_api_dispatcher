import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Workspace, WorkspaceRole } from "@/lib/supabase/database.types";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

export type WorkspaceWithRole = Workspace & { role: WorkspaceRole };

/**
 * Lista workspaces do usuário atual.
 * Usa admin client com filtro manual por user_id, pois RLS via @supabase/ssr
 * server-side nem sempre propaga JWT consistentemente. Auth via getUser().
 */
export async function getUserWorkspaces(): Promise<WorkspaceWithRole[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_member")
    .select("role, created_at, workspace:workspace_id (*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  type Row = (typeof data)[number];
  type WithWorkspace = Row & { workspace: Workspace };
  return data
    .filter((row): row is WithWorkspace => row.workspace !== null)
    .map((row) => ({ ...row.workspace, role: row.role }));
}

/**
 * Workspace ativo, baseado em cookie. Faz fallback no primeiro disponível.
 * Retorna null se usuário não tem nenhum workspace.
 */
export async function getActiveWorkspace(): Promise<WorkspaceWithRole | null> {
  const workspaces = await getUserWorkspaces();
  if (workspaces.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  if (activeId) {
    const found = workspaces.find((w) => w.id === activeId);
    if (found) return found;
  }

  return workspaces[0] ?? null;
}

/**
 * Server-side: redireciona pra /onboarding se usuário não tem workspace.
 */
export async function requireActiveWorkspace(): Promise<WorkspaceWithRole> {
  const workspace = await getActiveWorkspace();
  if (!workspace) redirect("/onboarding");
  return workspace;
}
