import "server-only";

import crypto from "node:crypto";
import { after, NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { conversationKey } from "@/lib/phone/e164";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleFlowReply, startCampaignFlowOnReply } from "@/server/flow-engine";
import { getWorkspaceMemberIds, sendPushToUsers } from "@/server/push";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

type DispatchRecipientUpdate = Database["public"]["Tables"]["dispatch_recipient"]["Update"];

// =============================================================================
// Webhook da WhatsApp Cloud API (Meta).
//
// GET  -> verificação (hub.verify_token == META_VERIFY_TOKEN), feita 1x pela
//         Meta ao registrar a Callback URL no painel do app.
// POST -> eventos: status de entrega/leitura (statuses[]) e reações
//         (messages[] com type "reaction"). Atualiza dispatch_recipient por
//         meta_message_id (wamid — único globalmente, sem precisar resolver
//         tenant/workspace primeiro).
//
// Valida X-Hub-Signature-256 com META_APP_SECRET antes de processar.
// =============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && serverEnv.META_VERIFY_TOKEN && token === serverEnv.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse(null, { status: 403 });
}

function isValidSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = serverEnv.META_APP_SECRET;
  if (!secret) return true; // sem secret configurado — não bloqueia
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type MetaStatus = {
  id?: string;
  status?: string;
  errors?: {
    code?: number;
    title?: string;
    message?: string;
    error_data?: { details?: string };
  }[];
};

type MetaReaction = {
  message_id?: string;
  emoji?: string;
};

type MetaMedia = { id?: string; mime_type?: string; caption?: string };

type MetaInboundMessage = {
  id?: string;
  from?: string;
  to?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: MetaMedia;
  video?: MetaMedia;
  document?: MetaMedia & { filename?: string };
  audio?: MetaMedia;
  sticker?: MetaMedia;
  location?: { latitude?: number; longitude?: number; name?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
  reaction?: MetaReaction;
};

type MetaContactProfile = { wa_id?: string; profile?: { name?: string } };

// ----------------------------------------------------------------------------
// Espelho de conversas
// ----------------------------------------------------------------------------

/** Texto legível e metadados de mídia, seja qual for o tipo da mensagem. */
function extractContent(msg: MetaInboundMessage): {
  type: string;
  body: string | null;
  mediaId: string | null;
  mediaMime: string | null;
} {
  const type = msg.type ?? "unknown";
  const media = (m?: MetaMedia) => ({
    mediaId: m?.id ?? null,
    mediaMime: m?.mime_type ?? null,
  });

  switch (type) {
    case "text":
      return { type, body: msg.text?.body ?? null, mediaId: null, mediaMime: null };
    case "image":
      return { type, body: msg.image?.caption ?? null, ...media(msg.image) };
    case "video":
      return { type, body: msg.video?.caption ?? null, ...media(msg.video) };
    case "document":
      return {
        type,
        body: msg.document?.caption ?? msg.document?.filename ?? null,
        ...media(msg.document),
      };
    case "audio":
      return { type, body: null, ...media(msg.audio) };
    case "sticker":
      return { type, body: null, ...media(msg.sticker) };
    case "location": {
      const loc = msg.location;
      const coords =
        loc?.latitude !== undefined && loc?.longitude !== undefined
          ? `${loc.latitude}, ${loc.longitude}`
          : null;
      return { type, body: loc?.name ?? coords, mediaId: null, mediaMime: null };
    }
    case "button":
      return { type, body: msg.button?.text ?? null, mediaId: null, mediaMime: null };
    case "interactive":
      return {
        type,
        body: msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? null,
        mediaId: null,
        mediaMime: null,
      };
    default:
      return { type, body: null, mediaId: null, mediaMime: null };
  }
}

/** A Meta manda o timestamp em segundos. */
function messageTimestamp(msg: MetaInboundMessage): string {
  const raw = Number(msg.timestamp);
  if (!Number.isFinite(raw) || raw <= 0) return new Date().toISOString();
  return new Date(raw * 1000).toISOString();
}

type Tenant = {
  workspaceId: string;
  connectionId: string;
  phoneNumberId: string;
};

/**
 * Descobre de quem é o evento. A Meta entrega tudo no mesmo endpoint, então o
 * roteamento vem da WABA (`entry.id`) ou do número que recebeu
 * (`value.metadata.phone_number_id`). Sem isso não dá pra saber em qual
 * workspace gravar.
 */
async function resolveTenant(
  admin: ReturnType<typeof createAdminClient>,
  wabaId: string | null,
  phoneNumberId: string | null,
): Promise<Tenant | null> {
  if (phoneNumberId) {
    const { data } = await admin
      .from("workspace_phone_number")
      .select("workspace_id, connection_id, phone_number_id")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();
    if (data) {
      return {
        workspaceId: data.workspace_id,
        connectionId: data.connection_id,
        phoneNumberId: data.phone_number_id,
      };
    }
  }

  if (wabaId) {
    const { data } = await admin
      .from("workspace_meta_connection")
      .select("id, workspace_id")
      .eq("waba_id", wabaId)
      .maybeSingle();
    if (data && phoneNumberId) {
      return {
        workspaceId: data.workspace_id,
        connectionId: data.id,
        phoneNumberId,
      };
    }
  }

  return null;
}

/** Prévia curta pra notificação: mídia não tem texto, então vira o rótulo. */
const PUSH_PREVIEW: Record<string, string> = {
  image: "📷 Imagem",
  video: "🎥 Vídeo",
  audio: "🎤 Áudio",
  sticker: "Figurinha",
  document: "📄 Documento",
  location: "📍 Localização",
  contacts: "Contato",
};

/**
 * Avisa o time que chegou mensagem.
 *
 * A `tag` é a conversa: mensagens seguidas da mesma pessoa substituem a
 * notificação anterior em vez de empilhar cinco avisos na tela de quem está
 * atendendo.
 */
async function notifyInbound(
  tenant: Tenant,
  msg: MetaInboundMessage,
  contactName: string | null,
): Promise<void> {
  const phone = conversationKey(msg.from);
  if (!phone) return;

  const content = extractContent(msg);
  const body = content.body?.trim() || PUSH_PREVIEW[content.type] || "Nova mensagem";

  const members = await getWorkspaceMemberIds(tenant.workspaceId);
  if (members.length === 0) return;

  await sendPushToUsers(members, {
    title: contactName || phone,
    body: body.slice(0, 120),
    url: `/conversas?tel=${encodeURIComponent(phone)}`,
    tag: `conversa:${phone}`,
  });
}

/** Casa o número da conversa com um contato já cadastrado, se existir. */
async function findContactId(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  phone: string,
): Promise<string | null> {
  const { data } = await admin
    .from("contact")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("phone_e164", phone)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Grava uma mensagem no espelho.
 *
 * `direction` 'in' = o contato escreveu; 'out' = saiu do número do workspace,
 * inclusive pelo app do celular (echo de coexistência). A chave da conversa é
 * sempre o número do CONTATO, nunca o da empresa.
 */
async function mirrorMessage(
  admin: ReturnType<typeof createAdminClient>,
  tenant: Tenant,
  msg: MetaInboundMessage,
  direction: "in" | "out",
  contactName: string | null,
) {
  // Numa mensagem recebida o contato é o remetente; num echo, o destinatário.
  const contactPhone = direction === "in" ? msg.from : msg.to;
  if (!contactPhone) return;

  // Canoniza aqui e não na leitura: a chave precisa ser a mesma da mensagem
  // que saiu, senão a resposta abre uma conversa paralela.
  const normalized = conversationKey(contactPhone);
  const { type, body, mediaId, mediaMime } = extractContent(msg);

  // Insert simples em vez de upsert: o índice único de (workspace, message_id)
  // é PARCIAL (`where meta_message_id is not null`), e o Postgres recusa um
  // ON CONFLICT cujo alvo não carregue o mesmo predicado — coisa que o
  // supabase-js não sabe expressar. O upsert falhava em toda mensagem, e como
  // ninguém olhava o erro, a conversa sumia sem deixar rastro.
  const { error } = await admin.from("whatsapp_message").insert({
    workspace_id: tenant.workspaceId,
    connection_id: tenant.connectionId,
    phone_number_id: tenant.phoneNumberId,
    contact_phone_e164: normalized,
    contact_id: await findContactId(admin, tenant.workspaceId, normalized),
    contact_name: contactName,
    direction,
    type,
    body,
    media_id: mediaId,
    media_mime: mediaMime,
    meta_message_id: msg.id ?? null,
    // Echo veio do celular: já saiu, mas a plataforma não acompanha o status.
    status: direction === "out" ? "sent" : null,
    // Recebida entra como não lida; o que sai já nasce lido.
    read_internally: direction === "out",
    sent_at: messageTimestamp(msg),
    raw: msg as never,
  });

  // 23505 = violação de unicidade: a Meta reentregou um evento que já temos.
  // É o funcionamento esperado do índice, não erro.
  if (error && error.code !== "23505") {
    console.error("[meta/webhook] falha gravando mensagem:", error.code, error.message);
  }
}

async function processStatus(admin: ReturnType<typeof createAdminClient>, status: MetaStatus) {
  if (!status.id || !status.status) return;
  if (!["delivered", "read", "failed"].includes(status.status)) return; // "sent" já é gravado no envio

  const now = new Date().toISOString();
  const patch: DispatchRecipientUpdate = {
    status: status.status as DispatchRecipientUpdate["status"],
  };
  if (status.status === "delivered") patch.delivered_at = now;
  if (status.status === "read") patch.read_at = now;
  if (status.status === "failed") {
    patch.failed_at = now;
    const err = status.errors?.[0];
    if (err) {
      patch.error_code = String(err.code ?? "");
      // `error_data.details` costuma ter o motivo real e mais específico do
      // que title/message sozinhos (ex.: "Business eligibility payment issue").
      const base = err.title ?? err.message ?? "";
      const details = err.error_data?.details;
      const full = details && details !== base ? `${base} - ${details}` : base;
      patch.error_message = String(full).slice(0, 500);
    }
  }

  const { data: updated } = await admin
    .from("dispatch_recipient")
    .update(patch)
    .eq("meta_message_id", status.id)
    .select("id");

  // Status de mensagem que não é de transmissão (teste, resposta do inbox,
  // fluxo) não casa aqui. Se for falha, registra: era o buraco em que sumia a
  // explicação de "enviou mas não chegou".
  if ((!updated || updated.length === 0) && status.status === "failed") {
    const err = status.errors?.[0];
    console.warn(
      "[meta/webhook] falha em mensagem fora de transmissão",
      JSON.stringify({
        message_id: status.id,
        code: err?.code,
        title: err?.title,
        details: err?.error_data?.details,
      }),
    );
  }
}

/** Espelha o status de entrega nas mensagens que saíram pela plataforma. */
async function processMirrorStatus(
  admin: ReturnType<typeof createAdminClient>,
  status: MetaStatus,
) {
  if (!status.id || !status.status) return;
  if (!["sent", "delivered", "read", "failed"].includes(status.status)) return;

  const err = status.errors?.[0];
  // Mesma regra do disparo: o detalhe costuma ter o motivo real.
  const base = err ? String(err.title ?? err.message ?? "") : "";
  const details = err?.error_data?.details;
  const full = details && details !== base ? `${base} - ${details}` : base;

  await admin
    .from("whatsapp_message")
    .update({
      status: status.status as "sent" | "delivered" | "read" | "failed",
      error_message: err ? full.slice(0, 500) : null,
    })
    .eq("meta_message_id", status.id)
    .eq("direction", "out");
}

async function processReaction(admin: ReturnType<typeof createAdminClient>, reaction: MetaReaction) {
  if (!reaction.message_id) return;
  await admin
    .from("dispatch_recipient")
    .update({ reaction_emoji: reaction.emoji || null, reaction_at: new Date().toISOString() })
    .eq("meta_message_id", reaction.message_id);
}

// Repassa o payload cru pra URL antiga (se configurada) — best-effort, com
// timeout curto, nunca bloqueia nem derruba a resposta pra Meta.
async function forwardToLegacyUrl(rawBody: string, signatureHeader: string | null) {
  const url = serverEnv.META_WEBHOOK_FORWARD_URL;
  if (!url) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signatureHeader ? { "X-Hub-Signature-256": signatureHeader } : {}),
      },
      body: rawBody,
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (e) {
    console.error("[meta/webhook] forward falhou:", (e as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-hub-signature-256");

  if (!isValidSignature(rawBody, signatureHeader)) {
    return new NextResponse(null, { status: 401 });
  }

  // `after` roda depois da resposta ir embora, sem a função serverless ser
  // encerrada no meio — que era o motivo do await aqui antes. Importa mais
  // agora que a Meta entrega TODO o tráfego neste endpoint: aguardar o repasse
  // somava até 4s em cada evento, e um destino lento ou fora do ar empurraria
  // a resposta pro timeout da Meta, que então reenvia o evento.
  after(() => forwardToLegacyUrl(rawBody, signatureHeader));

  let body: {
    object?: string;
    // `entry.id` é o WABA id — usado pra descobrir de qual workspace é o evento.
    entry?: { id?: string; changes?: { value?: Record<string, unknown> }[] }[];
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse(null, { status: 200 });
  }

  if (body.object !== "whatsapp_business_account") {
    return new NextResponse(null, { status: 200 });
  }

  const admin = createAdminClient();

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      const statuses = (value.statuses as MetaStatus[] | undefined) ?? [];
      for (const status of statuses) {
        try {
          await processStatus(admin, status);
          await processMirrorStatus(admin, status);
        } catch (e) {
          console.error("[meta/webhook] status:", (e as Error).message);
        }
      }

      const messages = (value.messages as MetaInboundMessage[] | undefined) ?? [];
      // Coexistência: mensagens que a empresa mandou pelo app do celular
      // chegam aqui, não em `messages`. Sem isso o espelho mostraria só um
      // lado da conversa quando o atendimento acontece fora da plataforma.
      //
      // Depende do campo `smb_message_echoes` estar assinado no painel do app
      // (Meta App Dashboard → WhatsApp → Configuração → Campos do webhook).
      // O campo `messages`, que traz as recebidas e os status, já vem ligado.
      const echoes = (value.message_echoes as MetaInboundMessage[] | undefined) ?? [];

      if (messages.length > 0 || echoes.length > 0) {
        const metadata = value.metadata as { phone_number_id?: string } | undefined;
        const tenant = await resolveTenant(
          admin,
          typeof entry.id === "string" ? entry.id : null,
          metadata?.phone_number_id ?? null,
        );

        if (!tenant) {
          // Número que não está conectado a nenhum workspace. Guarda a
          // evidência: sem isso o cliente escreve, nada aparece, e não há como
          // provar depois se chegou ou não.
          console.warn("[meta/webhook] tenant não encontrado", metadata?.phone_number_id);
          await admin.from("webhook_unmatched").insert({
            waba_id: typeof entry.id === "string" ? entry.id : null,
            phone_number_id: metadata?.phone_number_id ?? null,
            from_phone: messages[0]?.from ?? echoes[0]?.to ?? null,
            kind: messages.length > 0 ? "messages" : "echoes",
            payload: { messages: messages.slice(0, 3), echoes: echoes.slice(0, 3) } as never,
          });
        } else {
          const profiles = (value.contacts as MetaContactProfile[] | undefined) ?? [];
          const nameOf = (waId?: string) =>
            profiles.find((c) => c.wa_id === waId)?.profile?.name ?? null;

          for (const msg of messages) {
            try {
              // Reação não é bolha de conversa: é um adorno numa mensagem que
              // já existe. Continua atualizando o destinatário do disparo.
              if (msg.type === "reaction" && msg.reaction) {
                await processReaction(admin, msg.reaction);
                continue;
              }
              await mirrorMessage(admin, tenant, msg, "in", nameOf(msg.from));

              // Notificação vem depois do espelho: se o push falhar, a
              // conversa já está gravada e a tela mostra a mensagem.
              try {
                await notifyInbound(tenant, msg, nameOf(msg.from));
              } catch (e) {
                console.error("[meta/webhook] push:", (e as Error).message);
              }

              // A resposta pode ser o que o fluxo estava esperando. Vai depois
              // do espelho pra conversa nunca depender do motor ter dado certo.
              try {
                const content = extractContent(msg);
                await handleFlowReply({
                  workspaceId: tenant.workspaceId,
                  phoneE164: conversationKey(msg.from),
                  text: content.body,
                });
                // Sem fluxo em andamento, a resposta pode ser o gatilho da
                // campanha que acabou de transmitir pra essa pessoa.
                await startCampaignFlowOnReply({
                  workspaceId: tenant.workspaceId,
                  phoneE164: conversationKey(msg.from),
                  connectionId: tenant.connectionId,
                  phoneNumberId: tenant.phoneNumberId,
                });
              } catch (e) {
                console.error("[meta/webhook] fluxo:", (e as Error).message);
              }
            } catch (e) {
              console.error("[meta/webhook] mensagem recebida:", (e as Error).message);
            }
          }

          for (const msg of echoes) {
            try {
              await mirrorMessage(admin, tenant, msg, "out", nameOf(msg.to));
            } catch (e) {
              console.error("[meta/webhook] echo:", (e as Error).message);
            }
          }
        }
      }
    }
  }

  return new NextResponse(null, { status: 200 });
}
