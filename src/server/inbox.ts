import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { WhatsappConversation, WhatsappMessage } from "@/lib/supabase/database.types";

export type { WhatsappConversation, WhatsappMessage };

/**
 * Janela de atendimento de 24 horas.
 *
 * Fora dela a Meta só aceita template. O detalhe que engana: ela responde 200
 * com um message id mesmo assim e descarta a mensagem depois, então sem essa
 * checagem o atendente vê "enviado" e o cliente nunca recebe. Por isso a
 * janela é calculada e mostrada antes de escrever.
 */
export type Window24h = {
  /** `null` quando não dá pra saber (sem histórico espelhado). */
  open: boolean | null;
  lastInboundAt: string | null;
  /** Horas restantes, arredondadas pra baixo. */
  hoursLeft: number | null;
};

export function windowFromLastInbound(lastInboundAt: string | null): Window24h {
  if (!lastInboundAt) return { open: null, lastInboundAt: null, hoursLeft: null };
  const elapsedHours = (Date.now() - new Date(lastInboundAt).getTime()) / 3_600_000;
  const open = elapsedHours < 24;
  return {
    open,
    lastInboundAt,
    hoursLeft: open ? Math.max(0, Math.floor(24 - elapsedHours)) : 0,
  };
}

export async function listConversations(
  workspaceId: string,
  opts: { limit?: number; offset?: number; search?: string } = {},
): Promise<WhatsappConversation[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_whatsapp_conversations", {
    p_workspace_id: workspaceId,
    p_limit: opts.limit ?? 30,
    p_offset: opts.offset ?? 0,
    p_search: opts.search?.trim() || null,
  });
  if (error) {
    console.error("[inbox] listConversations:", error.message);
    return [];
  }
  return data ?? [];
}

export type Thread = {
  phone: string;
  contactName: string | null;
  contactId: string | null;
  connectionId: string | null;
  phoneNumberId: string | null;
  messages: WhatsappMessage[];
  window: Window24h;
};

export async function getThread(
  workspaceId: string,
  phone: string,
  limit = 200,
): Promise<Thread | null> {
  const admin = createAdminClient();

  // Últimas N mensagens, depois invertidas — quem abre a conversa quer ver o
  // fim dela, não o começo.
  const { data, error } = await admin
    .from("whatsapp_message")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("contact_phone_e164", phone)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) return null;

  const messages = [...data].reverse();
  const lastInbound = data.find((m) => m.direction === "in");
  const named = data.find((m) => m.contact_name);
  const last = data[0]!;

  return {
    phone,
    contactName: named?.contact_name ?? null,
    contactId: data.find((m) => m.contact_id)?.contact_id ?? null,
    connectionId: last.connection_id,
    phoneNumberId: last.phone_number_id,
    messages,
    window: windowFromLastInbound(lastInbound?.sent_at ?? null),
  };
}

/** Marca as recebidas como lidas dentro da plataforma (não é read receipt). */
export async function markThreadRead(workspaceId: string, phone: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("whatsapp_message")
    .update({ read_internally: true })
    .eq("workspace_id", workspaceId)
    .eq("contact_phone_e164", phone)
    .eq("direction", "in")
    .eq("read_internally", false);
}

/**
 * Volta a conversa pra não lida. Marca só a última recebida: o contador da
 * lista conta mensagem, e marcar tudo de novo faria a conversa reaparecer com
 * "12 não lidas" semanas depois de já terem sido lidas.
 */
export async function markThreadUnread(workspaceId: string, phone: string): Promise<void> {
  const admin = createAdminClient();

  const { data: lastInbound } = await admin
    .from("whatsapp_message")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("contact_phone_e164", phone)
    .eq("direction", "in")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastInbound) return;

  await admin
    .from("whatsapp_message")
    .update({ read_internally: false })
    .eq("id", lastInbound.id);
}

/** Total de conversas com mensagem não lida — vai no selo do menu. */
export async function countUnreadThreads(workspaceId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("whatsapp_message")
    .select("contact_phone_e164")
    .eq("workspace_id", workspaceId)
    .eq("direction", "in")
    .eq("read_internally", false);
  if (error || !data) return 0;
  return new Set(data.map((r) => r.contact_phone_e164)).size;
}
