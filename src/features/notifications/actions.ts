"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/server/auth";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

/**
 * Guarda a assinatura deste navegador.
 *
 * O endpoint é único no sistema: se o mesmo navegador reassinar (o que
 * acontece quando o navegador roda as chaves dele), a linha é atualizada em
 * vez de duplicar.
 */
export async function subscribeToPushAction(
  input: PushSubscriptionInput,
): Promise<ActionResult> {
  const user = await requireUser();

  if (!input.endpoint || !input.p256dh || !input.auth) {
    return { ok: false, error: "Assinatura incompleta" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscription").upsert(
    {
      user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function unsubscribeFromPushAction(endpoint: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!endpoint) return { ok: false, error: "Assinatura não informada" };

  const admin = createAdminClient();
  // Filtra por user_id também: sem isso, saber um endpoint alheio bastaria pra
  // desligar a notificação de outra pessoa.
  const { error } = await admin
    .from("push_subscription")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
