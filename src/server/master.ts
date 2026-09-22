import "server-only";

import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, type AuthenticatedUser } from "@/server/auth";

/**
 * `profile.is_superadmin` já existe desde a migration inicial
 * (0001_init_auth_workspaces.sql) mas nunca tinha sido usado em código — é o
 * mecanismo certo pra gate do painel master (por usuário, editável via banco,
 * sem precisar de redeploy pra promover/revogar alguém).
 */
export async function requireMasterUser(): Promise<AuthenticatedUser> {
  const user = await requireUser();
  // 404 (não 403) — não revela que a rota existe pra quem não é master.
  if (!user.profile.is_superadmin) notFound();
  return user;
}

function countBy(rows: { workspace_id: string }[] | null): Map<string, number> {
  const map = new Map<string, number>();
  (rows ?? []).forEach((r) => map.set(r.workspace_id, (map.get(r.workspace_id) ?? 0) + 1));
  return map;
}

// ----------------------------------------------------------------------------
// Listagem cross-tenant pro painel master.
// ----------------------------------------------------------------------------
export type MasterConnectionSummary = {
  id: string;
  wabaId: string;
  businessName: string | null;
  connectionMethod: string;
  isCoexistence: boolean;
  canSendMessage: string | null;
};

export type MasterWorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  /** Logo da empresa, a mesma que o cliente vê no topo do menu dele. */
  logoUrl: string | null;
  createdAt: string;
  ownerEmail: string | null;
  memberCount: number;
  contactCount: number;
  totalSent: number;
  connections: MasterConnectionSummary[];
};

function connectionSummary(c: {
  id: string;
  waba_id: string;
  business_name: string | null;
  connection_method: string;
  health_status: unknown;
}): MasterConnectionSummary {
  const health = c.health_status as { can_send_message?: string } | null;
  return {
    id: c.id,
    wabaId: c.waba_id,
    businessName: c.business_name,
    connectionMethod: c.connection_method,
    isCoexistence: c.connection_method === "coexistence",
    canSendMessage: health?.can_send_message ?? null,
  };
}

export async function listWorkspacesForMaster(): Promise<MasterWorkspaceRow[]> {
  const admin = createAdminClient();

  const { data: workspaces } = await admin
    .from("workspace")
    .select("id, name, slug, logo_url, owner_id, created_at")
    .order("created_at", { ascending: false });
  if (!workspaces || workspaces.length === 0) return [];

  const workspaceIds = workspaces.map((w) => w.id);
  const ownerIds = [...new Set(workspaces.map((w) => w.owner_id))];

  // profile não tem e-mail (isso vive só no auth.users) — busca via admin auth,
  // uma chamada por owner único (lista de workspaces não costuma ser gigante).
  const [ownersRes, membersRes, contactsRes, dispatchesRes, connectionsRes] = await Promise.all([
    Promise.all(ownerIds.map((id) => admin.auth.admin.getUserById(id))),
    admin.from("workspace_member").select("workspace_id").in("workspace_id", workspaceIds),
    admin.from("contact").select("workspace_id").in("workspace_id", workspaceIds),
    admin.from("dispatch").select("id, workspace_id").in("workspace_id", workspaceIds),
    admin
      .from("workspace_meta_connection")
      .select("id, workspace_id, waba_id, business_name, connection_method, health_status")
      .in("workspace_id", workspaceIds),
  ]);

  const emailByUserId = new Map(
    ownersRes.map((r, i) => [ownerIds[i], r.data.user?.email ?? null] as const),
  );
  const memberCounts = countBy(membersRes.data);
  const contactCounts = countBy(contactsRes.data);

  // "Disparos" = mensagens já enviadas com sucesso (all-time), não quantidade
  // de transmissões — soma dispatch_recipient por trás de cada dispatch do
  // workspace.
  const dispatchIds = (dispatchesRes.data ?? []).map((d) => d.id);
  const workspaceByDispatchId = new Map(
    (dispatchesRes.data ?? []).map((d) => [d.id, d.workspace_id] as const),
  );
  const sentCountByWorkspace = new Map<string, number>();
  if (dispatchIds.length > 0) {
    const { data: recipients } = await admin
      .from("dispatch_recipient")
      .select("dispatch_id, status")
      .in("dispatch_id", dispatchIds)
      .in("status", ["sent", "delivered", "read"]);
    (recipients ?? []).forEach((r) => {
      const wsId = workspaceByDispatchId.get(r.dispatch_id);
      if (!wsId) return;
      sentCountByWorkspace.set(wsId, (sentCountByWorkspace.get(wsId) ?? 0) + 1);
    });
  }

  const connectionsByWorkspace = new Map<string, MasterConnectionSummary[]>();
  for (const c of connectionsRes.data ?? []) {
    const list = connectionsByWorkspace.get(c.workspace_id) ?? [];
    list.push(connectionSummary(c));
    connectionsByWorkspace.set(c.workspace_id, list);
  }

  return workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    logoUrl: w.logo_url,
    createdAt: w.created_at,
    ownerEmail: emailByUserId.get(w.owner_id) ?? null,
    memberCount: memberCounts.get(w.id) ?? 0,
    contactCount: contactCounts.get(w.id) ?? 0,
    totalSent: sentCountByWorkspace.get(w.id) ?? 0,
    connections: connectionsByWorkspace.get(w.id) ?? [],
  }));
}

// ----------------------------------------------------------------------------
// Membros do time master (Autoprocs) — quem tem `is_superadmin`. Separado dos
// membros de workspace de cliente; é o "time interno" que acessa /master.
// ----------------------------------------------------------------------------
export type MasterMember = {
  userId: string;
  fullName: string;
  email: string | null;
};

export async function listMasterMembers(): Promise<MasterMember[]> {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profile")
    .select("user_id, full_name")
    .eq("is_superadmin", true)
    .order("full_name", { ascending: true });
  if (!profiles || profiles.length === 0) return [];

  const emails = await Promise.all(
    profiles.map((p) => admin.auth.admin.getUserById(p.user_id)),
  );
  return profiles.map((p, i) => ({
    userId: p.user_id,
    fullName: p.full_name,
    email: emails[i]?.data.user?.email ?? null,
  }));
}
