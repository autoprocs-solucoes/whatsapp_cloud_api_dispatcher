import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/server/workspace";

export type TimelineDay = {
  date: string; // YYYY-MM-DD
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

export type FunnelStats = {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

export type DashboardStats = {
  contacts: { total: number };
  total_sent_alltime: number;
  dispatches: {
    delivery_rate_30d: number | null;
    read_rate_30d: number | null;
    last: {
      id: string;
      template_name: string | null;
      status: string;
      created_at: string;
      total_recipients: number;
      sent: number;
      delivered: number;
      read: number;
      failed: number;
    } | null;
  };
  timeline_30d: TimelineDay[];
  funnel_30d: FunnelStats;
};

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
      .gte("created_at", since30),
    admin
      .from("dispatch")
      .select("id, status, created_at, total_recipients, template:template_id(name)")
      .eq("workspace_id", workspaceId)
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
  if (dispatchIds30.length > 0) {
    const { data } = await admin
      .from("dispatch_recipient")
      .select("status, sent_at")
      .in("dispatch_id", dispatchIds30);
    recipients30 = data ?? [];
  }

  const funnel30: FunnelStats = {
    total: totalRecipientsSum30,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  };
  (recipients30 ?? []).forEach((r) => {
    if (r.status === "sent") funnel30.sent++;
    else if (r.status === "delivered") {
      funnel30.sent++;
      funnel30.delivered++;
    } else if (r.status === "read") {
      funnel30.sent++;
      funnel30.delivered++;
      funnel30.read++;
    } else if (r.status === "failed") funnel30.failed++;
  });

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

  let deliveryRate: number | null = null;
  let readRate: number | null = null;
  if (totalRecipientsSum30 > 0) {
    deliveryRate = funnel30.delivered / totalRecipientsSum30;
    readRate = funnel30.read / totalRecipientsSum30;
  }

  // ----------------------------------------------------------------------
  // Counts por status do último comunicado
  // ----------------------------------------------------------------------
  let lastWithCounts: DashboardStats["dispatches"]["last"] = null;
  if (lastDispatch.data) {
    const last = lastDispatch.data;
    const { data: lastRecipients } = await admin
      .from("dispatch_recipient")
      .select("status")
      .eq("dispatch_id", last.id);
    const counts = { sent: 0, delivered: 0, read: 0, failed: 0 };
    (lastRecipients ?? []).forEach((r) => {
      if (r.status === "sent") counts.sent++;
      else if (r.status === "delivered") counts.delivered++;
      else if (r.status === "read") counts.read++;
      else if (r.status === "failed") counts.failed++;
    });
    const tpl = last.template as { name: string } | null;
    lastWithCounts = {
      id: last.id,
      template_name: tpl?.name ?? null,
      status: last.status,
      created_at: last.created_at,
      total_recipients: last.total_recipients,
      ...counts,
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
    dispatches: {
      delivery_rate_30d: deliveryRate,
      read_rate_30d: readRate,
      last: lastWithCounts,
    },
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
