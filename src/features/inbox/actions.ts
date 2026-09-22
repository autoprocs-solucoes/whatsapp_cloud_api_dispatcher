"use server";

import { revalidatePath } from "next/cache";

import { conversationKey } from "@/lib/phone/e164";
import { GraphApiError, sendMediaById, sendTextMessage, uploadMediaFile } from "@/lib/meta/graph-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getThread, markThreadRead, markThreadUnread } from "@/server/inbox";
import { cancelFlowRunForContact } from "@/server/flow-engine";
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
  const threadKey = conversationKey(waId ?? phone);

  const { error } = await admin.from("whatsapp_message").insert({
    workspace_id: workspace.id,
    connection_id: thread.connectionId,
    phone_number_id: thread.phoneNumberId,
    contact_phone_e164: threadKey,
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

  // Gente assumiu a conversa: o fluxo automático sai de cena pra não falar por
  // cima do atendente.
  try {
    await cancelFlowRunForContact(workspace.id, threadKey);
  } catch (e) {
    console.error("[inbox] encerrar fluxo:", (e as Error).message);
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

/**
 * Marca a conversa como não lida e fecha a visualização — se continuasse
 * aberta, o próprio render marcaria como lida de novo no segundo seguinte.
 */
export async function markThreadUnreadAction(phone: string): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  if (!phone) return { ok: false, error: "Conversa inválida" };

  await markThreadUnread(workspace.id, phone);

  revalidatePath("/conversas");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// ----------------------------------------------------------------------------
// Anexo e áudio
// ----------------------------------------------------------------------------

/** Tipos que a Cloud API aceita, com o teto de tamanho de cada um. */
const MEDIA_RULES: { kind: "image" | "video" | "document" | "audio"; test: RegExp; maxBytes: number }[] = [
  { kind: "image", test: /^image\/(jpeg|png|webp)$/, maxBytes: 5 * 1024 * 1024 },
  { kind: "video", test: /^video\/(mp4|3gpp)$/, maxBytes: 16 * 1024 * 1024 },
  { kind: "audio", test: /^audio\//, maxBytes: 16 * 1024 * 1024 },
  { kind: "document", test: /.*/, maxBytes: 100 * 1024 * 1024 },
];

function mediaRuleFor(mime: string) {
  return MEDIA_RULES.find((r) => r.test.test(mime)) ?? MEDIA_RULES[MEDIA_RULES.length - 1]!;
}

/**
 * Envia arquivo ou áudio na conversa. Mesma regra do texto: fora da janela de
 * 24h a Meta aceita e descarta, então nem tenta.
 */
export async function sendMediaReplyAction(formData: FormData): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();

  const phone = String(formData.get("phone") ?? "").trim();
  const file = formData.get("file");
  const isVoice = String(formData.get("voice") ?? "") === "1";
  const caption = String(formData.get("caption") ?? "").trim();

  if (!phone) return { ok: false, error: "Conversa não identificada" };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo" };
  }

  const rule = mediaRuleFor(file.type || "application/octet-stream");
  if (file.size > rule.maxBytes) {
    const mb = Math.round(rule.maxBytes / (1024 * 1024));
    return { ok: false, error: `Arquivo muito grande (máx. ${mb}MB pra ${rule.kind})` };
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
  let mediaId: string;
  try {
    const uploaded = await uploadMediaFile({
      phoneNumberId: thread.phoneNumberId,
      token: connection.access_token,
      file,
      filename: file.name || (isVoice ? "audio.ogg" : "arquivo"),
      mimeType: file.type || "application/octet-stream",
    });
    mediaId = uploaded.id;

    const sent = await sendMediaById({
      phoneNumberId: thread.phoneNumberId,
      token: connection.access_token,
      to: phone.replace(/^\+/, ""),
      kind: rule.kind,
      mediaId,
      caption: caption || null,
      filename: rule.kind === "document" ? file.name : null,
      voice: isVoice,
    });
    messageId = sent.messageId;
    waId = sent.waId;
  } catch (e) {
    if (e instanceof GraphApiError) return { ok: false, error: `Meta: ${e.message}` };
    return { ok: false, error: `Falha no envio: ${(e as Error).message}` };
  }

  const threadKey = conversationKey(waId ?? phone);
  const { error } = await admin.from("whatsapp_message").insert({
    workspace_id: workspace.id,
    connection_id: thread.connectionId,
    phone_number_id: thread.phoneNumberId,
    contact_phone_e164: threadKey,
    contact_id: thread.contactId,
    contact_name: thread.contactName,
    direction: "out",
    type: rule.kind,
    body: caption || (rule.kind === "document" ? file.name : null),
    media_id: mediaId,
    media_mime: file.type || null,
    meta_message_id: messageId,
    status: "sent",
    read_internally: true,
    sent_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[inbox] espelho do anexo:", error.message);
  }

  try {
    await cancelFlowRunForContact(workspace.id, threadKey);
  } catch (e) {
    console.error("[inbox] encerrar fluxo:", (e as Error).message);
  }

  revalidatePath("/conversas");
  return { ok: true, data: undefined };
}
