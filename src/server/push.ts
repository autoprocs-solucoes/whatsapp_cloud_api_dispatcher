import "server-only";

import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Web Push.
 *
 * As chaves VAPID identificam o servidor pro serviço de push do navegador. A
 * pública vai pro cliente (é ela que a assinatura carrega); a privada assina e
 * nunca sai daqui.
 */
function configured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function ensureConfigured(): boolean {
  if (!configured()) return false;
  if (!ready) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:autoprocsolucoes@gmail.com",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    ready = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Pra onde o clique leva. */
  url?: string;
  /** Notificações com a mesma tag se substituem em vez de empilhar. */
  tag?: string;
};

/**
 * Manda a notificação pra todos os aparelhos das pessoas indicadas.
 *
 * Assinatura morta (404/410) é apagada na hora: o navegador já descartou, e
 * guardar lixo só faz a próxima rodada falhar de novo.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0) return 0;
  if (!ensureConfigured()) {
    console.warn("[push] VAPID não configurado — notificação não enviada");
    return 0;
  }

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscription")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (error) {
    console.error("[push] falha lendo assinaturas:", error.message);
    return 0;
  }
  if (!subs || subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(s.id);
        } else {
          console.error("[push] envio falhou:", status, (err as Error).message);
        }
      }
    }),
  );

  if (dead.length > 0) {
    await admin.from("push_subscription").delete().in("id", dead);
  }
  if (sent > 0) {
    await admin
      .from("push_subscription")
      .update({ last_used_at: new Date().toISOString() })
      .in(
        "id",
        subs.filter((s) => !dead.includes(s.id)).map((s) => s.id),
      );
  }

  return sent;
}

/** Owners do workspace — são eles que recebem aviso de transmissão concluída. */
export async function getWorkspaceOwnerIds(workspaceId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_member")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner");
  return (data ?? []).map((m) => m.user_id);
}
