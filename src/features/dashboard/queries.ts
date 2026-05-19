import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/server/workspace";

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
};

function thirtyDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
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
  const since = thirtyDaysAgoIso();

  const [
    contactsTotal,
    contactsOptOut,
    inProgress,
    last30dDispatches,
    lastDispatch,
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
      .eq("status", "running"),
    admin
      .from("dispatch")
      .select("id, total_recipients")
      .eq("workspace_id", workspace.id)
      .gte("created_at", since),
    admin
      .from("dispatch")
      .select("id, status, created_at, total_recipients, template:template_id(name)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Métricas de entrega últimos 30d: precisamos somar status dos recipients.
  let deliveryRate: number | null = null;
  let readRate: number | null = null;
  const dispatchIds = (last30dDispatches.data ?? []).map((d) => d.id);
  const totalRecipientsSum = (last30dDispatches.data ?? []).reduce(
    (acc, d) => acc + (d.total_recipients ?? 0),
    0,
  );

  if (dispatchIds.length > 0 && totalRecipientsSum > 0) {
    const { data: recipientsAgg } = await admin
      .from("dispatch_recipient")
      .select("status")
      .in("dispatch_id", dispatchIds);
    let delivered = 0;
    let read = 0;
    (recipientsAgg ?? []).forEach((r) => {
      if (r.status === "delivered") delivered++;
      if (r.status === "read") {
        delivered++;
        read++;
      }
    });
    deliveryRate = delivered / totalRecipientsSum;
    readRate = read / totalRecipientsSum;
  }

  // Counts por status do último comunicado.
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

  return {
    contacts: {
      total: contactsTotal.count ?? 0,
      opted_out: contactsOptOut.count ?? 0,
    },
    dispatches: {
      in_progress: inProgress.count ?? 0,
      last_30d_count: dispatchIds.length,
      delivery_rate_30d: deliveryRate,
      read_rate_30d: readRate,
      last: lastWithCounts,
    },
  };
}
