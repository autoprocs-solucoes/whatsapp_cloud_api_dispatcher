import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type MasterDispatchRow = {
  id: string;
  templateName: string | null;
  status: string;
  totalRecipients: number;
  createdAt: string;
  counts: Record<string, number>;
};

/**
 * Mesma lógica de `listDispatches` (features/dispatch/actions.ts), mas
 * parametrizada por workspaceId em vez de depender da sessão/workspace ativo
 * do usuário — uso exclusivo do painel master pra olhar qualquer cliente.
 */
export async function listDispatchesForMaster(workspaceId: string): Promise<MasterDispatchRow[]> {
  const admin = createAdminClient();
  const { data: dispatches } = await admin
    .from("dispatch")
    .select("id, status, total_recipients, created_at, template:template_id(name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!dispatches || dispatches.length === 0) return [];

  const ids = dispatches.map((d) => d.id);
  const { data: recipients } = await admin
    .from("dispatch_recipient")
    .select("dispatch_id, status")
    .in("dispatch_id", ids);

  const byDispatch: Record<string, Record<string, number>> = {};
  (recipients ?? []).forEach((r) => {
    const m = byDispatch[r.dispatch_id] ?? {};
    m[r.status] = (m[r.status] ?? 0) + 1;
    byDispatch[r.dispatch_id] = m;
  });

  return dispatches.map((d) => {
    const tpl = (d as unknown as { template: { name: string } | null }).template;
    return {
      id: d.id,
      templateName: tpl?.name ?? null,
      status: d.status,
      totalRecipients: d.total_recipients,
      createdAt: d.created_at,
      counts: byDispatch[d.id] ?? {},
    };
  });
}
