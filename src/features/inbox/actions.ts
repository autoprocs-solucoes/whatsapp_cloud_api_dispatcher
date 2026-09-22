"use server";

import { revalidatePath } from "next/cache";

import { sendTextMessage } from "@/lib/meta/graph-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getThread, markThreadRead } from "@/server/inbox";
import { requireActiveWorkspace } from "@/server/workspace";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

const MAX_TEXT_LENGTH = 4096;

/**
 * Responde uma conversa com texto livre.
 *
 * Recusa fora da janela de 24h de propósito: a Meta aceitaria a chamada e
 * devolveria um message id, mas descartaria a mensagem depois — o atendente
 * veria "enviado" e o cliente não receberia nada. Melhor barrar aqui e dizer
 * que é preciso usar um template.
 */
export async function sendReplyAction(formData: FormData): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();

  const phone = String(formData.get("phone") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();

  if (!phone) return { ok: false, error: "Conversa não identificada" };
  if (!text) return { ok: false, error: "Escreva uma mensagem" };
  if (text.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `Mensagem muito longa (máx. ${MAX_TEXT_LENGTH} caracteres)` };
  }

  const thread = await getThread(workspace.id, phone, 1);
  if (!thread || !thread.connectionId || !thread.phoneNumberId) {
    return { ok: false, error: "Conversa não encontrada" };
  }
  if (thread.window.open === false) {
    return {
      ok: false,
      error:
        "A janela de 24 horas fechou. Só é possível retomar com um template aprovado. Faça uma transmissão.",
    };
  }

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("workspace_meta_connection")
    .select("access_token")
    .eq("id", thread.connectionId)
    .maybeSingle();

  if (!connection?.access_token) {
    return { ok: false, error: "Conexão com a Meta indisponível" };
  }

  let messageId: string;
  let waId: string | null;
  try {
    const res = await sendTextMessage({
      phoneNumberId: thread.phoneNumberId,
      token: connection.access_token,
      to: phone.replace(/^\+/, ""),
      text,
    });
    messageId = res.messageId;
    waId = res.waId;
  } catch (e) {
    return { ok: false, error: `Falha no envio: ${(e as Error).message}` };
  }

  // Grava a bolha com o número que a Meta reconheceu, não o digitado — senão a
  // resposta abriria uma conversa paralela à que o webhook alimenta.
  const conversationKey = waId ? `+${waId.replace(/^\+/, "")}` : phone;

  const { error } = await admin.from("whatsapp_message").insert({
    workspace_id: workspace.id,
    connection_id: thread.connectionId,
    phone_number_id: thread.phoneNumberId,
    contact_phone_e164: conversationKey,
    contact_id: thread.contactId,
    contact_name: thread.contactName,
    direction: "out",
    type: "text",
    body: text,
    meta_message_id: messageId,
    status: "sent",
    read_internally: true,
    sent_at: new Date().toISOString(),
  });

  // A mensagem já saiu; falhar aqui só significa que o espelho ficou atrás — o
  // echo/status do webhook reconcilia. Não é motivo pra dizer que deu erro.
  if (error) {
    console.error("[inbox] espelho da resposta:", error.message);
  }

  revalidatePath("/conversas");
  return { ok: true, data: undefined };
}

export async function markThreadReadAction(phone: string): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  await markThreadRead(workspace.id, phone);
  revalidatePath("/conversas");
  return { ok: true, data: undefined };
}
