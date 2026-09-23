import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type StatusCounts = Record<string, number>;

/**
 * Quantos destinatários em cada status, por transmissão.
 *
 * Contar percorrendo `dispatch_recipient` parecia funcionar até a transmissão
 * passar de mil pessoas: o PostgREST corta a resposta em 1000 linhas e o total
 * simplesmente para de crescer. A soma é feita no banco.
 */
export async function statusCountsByDispatch(
  dispatchIds: string[],
): Promise<Map<string, StatusCounts>> {
  const out = new Map<string, StatusCounts>();
  if (dispatchIds.length === 0) return out;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("dispatch_status_counts", {
    p_dispatch_ids: dispatchIds,
  });
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const counts = out.get(row.dispatch_id) ?? {};
    counts[row.status] = (counts[row.status] ?? 0) + Number(row.n);
    out.set(row.dispatch_id, counts);
  }
  return out;
}

/** Os status que contam como mensagem entregue à Meta sem erro. */
export const SENT_STATUSES = ["sent", "delivered", "read"] as const;

export function sumSent(counts: StatusCounts | undefined): number {
  if (!counts) return 0;
  return SENT_STATUSES.reduce((total, s) => total + (counts[s] ?? 0), 0);
}

export type DailyCount = { day: string; status: string; n: number };

/** Contagem por dia (fuso de São Paulo) e status, para a linha do tempo. */
export async function dailyCounts(
  dispatchIds: string[],
  days = 30,
): Promise<DailyCount[]> {
  if (dispatchIds.length === 0) return [];

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("dispatch_daily_counts", {
    p_dispatch_ids: dispatchIds,
    p_days: days,
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({ day: r.day, status: r.status, n: Number(r.n) }));
}
