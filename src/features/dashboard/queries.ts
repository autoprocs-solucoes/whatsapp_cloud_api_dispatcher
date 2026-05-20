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

export type Achievements = {
  total_sent_alltime: number;
  this_month_sent: number;
  last_month_sent: number;
  month_delta_pct: number | null; // null se mês anterior = 0
  streak_days: number;
  next_milestone: number;
  next_milestone_progress: number; // 0..1
  best_day: { date: string; sent: number } | null;
};

export type DashboardStats = {
  contacts: { total: number; opted_out: number };
  dispatches: {
    in_progress: number;
    last_30d_count: number;
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
  achievements: Achievements;
};

const MILESTONES = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];

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

function startOfMonthIso(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function nextMilestone(total: number): { target: number; progress: number } {
  const target = MILESTONES.find((m) => m > total) ?? total + 100;
  const prev = MILESTONES.slice().reverse().find((m) => m <= total) ?? 0;
  const span = target - prev || 1;
  return { target, progress: Math.min(1, (total - prev) / span) };
}

function computeStreak(daysWithSends: Set<string>): number {
  // Streak: dias consecutivos com pelo menos 1 envio, contando a partir de hoje
  // (ou ontem se hoje ainda não teve nada — ainda válido).
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Permite "carência" de 1 dia: se hoje não teve, começa contando de ontem.
  const todayKey = dateKey(today.toISOString());
  const cursor = new Date(today);
  if (!daysWithSends.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let i = 0; i < 365; i++) {
    const key = dateKey(cursor.toISOString());
    if (daysWithSends.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Métricas agregadas do workspace ativo. Server-side only.
 */
export async function getDashboardStats(): Promise<DashboardStats | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();
  const since30 = daysAgoIso(30);
  const now = new Date();
  const thisMonthStart = startOfMonthIso(now);
  const lastMonthStart = startOfMonthIso(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
  );

  // ----------------------------------------------------------------------
  // Counts básicos paralelos
  // ----------------------------------------------------------------------
  const [
    contactsTotal,
    contactsOptOut,
    inProgress,
    last30dDispatches,
    lastDispatch,
    allDispatchIds,
  ] = await Promise.all([
    admin
      .from("contact")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id),
    admin
      .from("contact")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("opt_out", true),
    admin
      .from("dispatch")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .in("status", ["queued", "running"]),
    admin
      .from("dispatch")
      .select("id, total_recipients")
      .eq("workspace_id", workspace.id)
      .gte("created_at", since30),
    admin
      .from("dispatch")
      .select("id, status, created_at, total_recipients, template:template_id(name)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("dispatch")
      .select("id")
      .eq("workspace_id", workspace.id),
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
  let recipients30:
    | Array<{ status: string; sent_at: string | null }>
    | null = null;
  if (dispatchIds30.length > 0) {
    const { data } = await admin
      .from("dispatch_recipient")
      .select("status, sent_at")
      .in("dispatch_id", dispatchIds30);
    recipients30 = data ?? [];
  }

  // Funil 30d
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

  // Timeline 30d: bucketiza por sent_at (mesmo se delivered/read, usa sent_at).
  const timelineMap = new Map<string, TimelineDay>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = dateKey(d.toISOString());
    timelineMap.set(key, {
      date: key,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    });
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

  // Taxas 30d
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
  // Achievements (all-time + mês atual/anterior + streak + marco)
  // ----------------------------------------------------------------------
  let totalSentAllTime = 0;
  let thisMonthSent = 0;
  let lastMonthSent = 0;
  let bestDay: { date: string; sent: number } | null = null;
  const daysWithSends = new Set<string>();

  if (allIds.length > 0) {
    // Pega todos recipients enviados (sent_at not null) do workspace.
    // Pra workspaces gigantes virou problema; paginar se virar gargalo.
    const { data: sentRows } = await admin
      .from("dispatch_recipient")
      .select("sent_at, status")
      .in("dispatch_id", allIds)
      .not("sent_at", "is", null);

    const perDay = new Map<string, number>();
    (sentRows ?? []).forEach((r) => {
      if (!r.sent_at) return;
      if (r.status === "failed") return; // só conta envios bem-sucedidos
      totalSentAllTime++;
      const key = dateKey(r.sent_at);
      daysWithSends.add(key);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
      if (r.sent_at >= thisMonthStart) thisMonthSent++;
      else if (r.sent_at >= lastMonthStart) lastMonthSent++;
    });

    for (const [date, sent] of perDay) {
      if (!bestDay || sent > bestDay.sent) bestDay = { date, sent };
    }
  }

  const monthDelta =
    lastMonthSent > 0 ? (thisMonthSent - lastMonthSent) / lastMonthSent : null;

  const { target, progress } = nextMilestone(totalSentAllTime);

  const achievements: Achievements = {
    total_sent_alltime: totalSentAllTime,
    this_month_sent: thisMonthSent,
    last_month_sent: lastMonthSent,
    month_delta_pct: monthDelta,
    streak_days: computeStreak(daysWithSends),
    next_milestone: target,
    next_milestone_progress: progress,
    best_day: bestDay,
  };

  return {
    contacts: {
      total: contactsTotal.count ?? 0,
      opted_out: contactsOptOut.count ?? 0,
    },
    dispatches: {
      in_progress: inProgress.count ?? 0,
      last_30d_count: dispatchIds30.length,
      delivery_rate_30d: deliveryRate,
      read_rate_30d: readRate,
      last: lastWithCounts,
    },
    timeline_30d: timeline30,
    funnel_30d: funnel30,
    achievements,
  };
}
