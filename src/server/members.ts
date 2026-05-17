import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/supabase/database.types";

export type MemberRow = {
  user_id: string;
  full_name: string;
  email: string;
  role: WorkspaceRole;
  created_at: string;
};

/**
 * Lista membros do workspace (com email vindo de auth.users via admin).
 * Auth check via getUser() + uso de admin pra contornar limitação do RLS
 * server-side com @supabase/ssr.
 */
export async function getWorkspaceMembers(workspaceId: string): Promise<MemberRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();

  // Valida que o usuário é membro do workspace antes de listar.
  const { data: requester } = await admin
    .from("workspace_member")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!requester) return [];

  const { data: members, error } = await admin
    .from("workspace_member")
    .select("user_id, role, created_at, profile:user_id (full_name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error || !members) return [];

  const result = await Promise.all(
    members.map(async (m) => {
      const { data: userData } = await admin.auth.admin.getUserById(m.user_id);
      type ProfileShape = { full_name: string };
      const profile = (Array.isArray(m.profile) ? m.profile[0] : m.profile) as
        | ProfileShape
        | null
        | undefined;
      return {
        user_id: m.user_id,
        full_name: profile?.full_name ?? "",
        email: userData.user?.email ?? "",
        role: m.role,
        created_at: m.created_at,
      } satisfies MemberRow;
    }),
  );

  return result;
}
