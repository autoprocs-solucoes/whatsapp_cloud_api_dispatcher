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
  const errors: { status?: number; message: string }[] = [];
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
        errors.push({ status, message: (err as Error).message.slice(0, 200) });
        if (status === 404 || status === 410) {
          // Inscrição morta: o navegador já descartou. Apagar evita insistir
          // pra sempre num endereço que não existe mais.
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

  // Rastro da tentativa: é o que responde "foi enviado?" depois do fato.
  await admin.from("push_log").insert({
    title: payload.title.slice(0, 120),
    tag: payload.tag ?? null,
    targets: subs.length,
    sent,
    failed: subs.length - sent,
    detail: errors.length > 0 ? (errors as never) : null,
  });
  // Sete dias bastam pra investigar e evitam a tabela virar depósito.
  await admin
    .from("push_log")
    .delete()
    .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

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

/**
 * Todo mundo do workspace — quem atende precisa saber que chegou mensagem,
 * não só o dono. Diferente do aviso de transmissão, que é coisa de owner.
 */
export async function getWorkspaceMemberIds(workspaceId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_member")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  return (data ?? []).map((m) => m.user_id);
}
