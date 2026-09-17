import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildFunnel, countByStatus, type Funnel } from "@/lib/metrics/funnel";
import { requireActiveWorkspace } from "@/server/workspace";

export type TimelineDay = {
  date: string; // YYYY-MM-DD
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

export type DashboardStats = {
  contacts: { total: number };
  total_sent_alltime: number;
  dispatches: {
    last: {
      id: string;
      template_name: string | null;
      status: string;
      created_at: string;
      funnel: Funnel;
    } | null;
  };
  timeline_30d: TimelineDay[];
  funnel_30d: Funnel;
};

/**
 * Rascunho nunca foi disparado e cancelado foi abortado — nenhum dos dois é
 * "mensagem programada" do ponto de vista do cliente. Contá-los no denominador
 * afundava a taxa de entrega de quem deixava rascunhos grandes salvos.
 */
const COUNTED_DISPATCH_STATUSES = ["queued", "running", "done", "failed"] as const;

function startOfDayIso(d: Date): string {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.toISOString();
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDayIso(d);
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Métricas agregadas de um workspace específico. Server-side only.
 * Não depende de sessão/cookie — quem chama já resolveu o workspace (uso
 * direto pelo dashboard do cliente, via `getDashboardStats`, e pelo painel
 * master, que olha qualquer workspace).
 */
export async function getDashboardStatsForWorkspace(
  workspaceId: string,
): Promise<DashboardStats> {
  const admin = createAdminClient();
  const since30 = daysAgoIso(30);

  const [contactsTotal, last30dDispatches, lastDispatch, allDispatchIds] = await Promise.all([
    admin
      .from("contact")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    admin
      .from("dispatch")
      .select("id, total_recipients")
      .eq("workspace_id", workspaceId)
      .in("status", COUNTED_DISPATCH_STATUSES)
      .gte("created_at", since30),
    admin
      .from("dispatch")
      .select("id, status, created_at, total_recipients, template:template_id(name)")
      .eq("workspace_id", workspaceId)
      .in("status", COUNTED_DISPATCH_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("dispatch").select("id").eq("workspace_id", workspaceId),
  ]);

  const dispatchIds30 = (last30dDispatches.data ?? []).map((d) => d.id);
  const allIds = (allDispatchIds.data ?? []).map((d) => d.id);
  const totalRecipientsSum30 = (last30dDispatches.data ?? []).reduce(
    (acc, d) => acc + (d.total_recipients ?? 0),
    0,
  );

  // ----------------------------------------------------------------------
  // Recipients dos últimos 30d (pra timeline + funil)
  // ----------------------------------------------------------------------
  let recipients30: Array<{ status: string; sent_at: string | null }> | null = null;
  let reactions30 = 0;
  if (dispatchIds30.length > 0) {
    const [{ data }, { count: reactionCount }] = await Promise.all([
      admin.from("dispatch_recipient").select("status, sent_at").in("dispatch_id", dispatchIds30),
      admin
        .from("dispatch_recipient")
        .select("id", { count: "exact", head: true })
        .in("dispatch_id", dispatchIds30)
        .not("reaction_emoji", "is", null),
    ]);
    recipients30 = data ?? [];
    reactions30 = reactionCount ?? 0;
  }

  const funnel30 = buildFunnel(
    countByStatus(recipients30 ?? []),
    totalRecipientsSum30,
    reactions30,
  );

  const timelineMap = new Map<string, TimelineDay>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = dateKey(d.toISOString());
    timelineMap.set(key, { date: key, sent: 0, delivered: 0, read: 0, failed: 0 });
  }
  (recipients30 ?? []).forEach((r) => {
    if (!r.sent_at) return;
    const key = dateKey(r.sent_at);
    const day = timelineMap.get(key);
    if (!day) return;
    if (r.status === "sent") day.sent++;
    else if (r.status === "delivered") {
      day.sent++;
      day.delivered++;
    } else if (r.status === "read") {
      day.sent++;
      day.delivered++;
      day.read++;
    } else if (r.status === "failed") day.failed++;
  });
  const timeline30: TimelineDay[] = Array.from(timelineMap.values());

  // ----------------------------------------------------------------------
  // Funil do último comunicado
  // ----------------------------------------------------------------------
  let lastWithFunnel: DashboardStats["dispatches"]["last"] = null;
  if (lastDispatch.data) {
    const last = lastDispatch.data;
    const [{ data: lastRecipients }, { count: lastReactions }] = await Promise.all([
      admin.from("dispatch_recipient").select("status").eq("dispatch_id", last.id),
      admin
        .from("dispatch_recipient")
        .select("id", { count: "exact", head: true })
        .eq("dispatch_id", last.id)
        .not("reaction_emoji", "is", null),
    ]);
    const tpl = last.template as { name: string } | null;
    lastWithFunnel = {
      id: last.id,
      template_name: tpl?.name ?? null,
      status: last.status,
      created_at: last.created_at,
      funnel: buildFunnel(
        countByStatus(lastRecipients ?? []),
        last.total_recipients,
        lastReactions ?? 0,
      ),
    };
  }

  // ----------------------------------------------------------------------
  // Total enviado all-time (só sucesso, sent_at not null).
  // ----------------------------------------------------------------------
  let totalSentAllTime = 0;
  if (allIds.length > 0) {
    const { count } = await admin
      .from("dispatch_recipient")
      .select("id", { count: "exact", head: true })
      .in("dispatch_id", allIds)
      .not("sent_at", "is", null)
      .neq("status", "failed");
    totalSentAllTime = count ?? 0;
  }

  return {
    contacts: { total: contactsTotal.count ?? 0 },
    total_sent_alltime: totalSentAllTime,
    dispatches: { last: lastWithFunnel },
    timeline_30d: timeline30,
    funnel_30d: funnel30,
  };
}

/**
 * Métricas do workspace ativo (sessão do usuário logado). Server-side only.
 */
export async function getDashboardStats(): Promise<DashboardStats | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const workspace = await requireActiveWorkspace();
  return getDashboardStatsForWorkspace(workspace.id);
}
