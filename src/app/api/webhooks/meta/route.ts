import "server-only";

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
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
  errors?: { code?: number; title?: string; message?: string }[];
};

type MetaReaction = {
  message_id?: string;
  emoji?: string;
};

type MetaInboundMessage = {
  type?: string;
  reaction?: MetaReaction;
};

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
      patch.error_message = String(err.title ?? err.message ?? "").slice(0, 500);
    }
  }

  await admin.from("dispatch_recipient").update(patch).eq("meta_message_id", status.id);
}

async function processReaction(admin: ReturnType<typeof createAdminClient>, reaction: MetaReaction) {
  if (!reaction.message_id) return;
  await admin
    .from("dispatch_recipient")
    .update({ reaction_emoji: reaction.emoji || null, reaction_at: new Date().toISOString() })
    .eq("meta_message_id", reaction.message_id);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!isValidSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse(null, { status: 401 });
  }

  let body: { object?: string; entry?: { changes?: { value?: Record<string, unknown> }[] }[] };
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
        } catch (e) {
          console.error("[meta/webhook] status:", (e as Error).message);
        }
      }

      const messages = (value.messages as MetaInboundMessage[] | undefined) ?? [];
      for (const msg of messages) {
        if (msg.type === "reaction" && msg.reaction) {
          try {
            await processReaction(admin, msg.reaction);
          } catch (e) {
            console.error("[meta/webhook] reaction:", (e as Error).message);
          }
        }
      }
    }
  }

  return new NextResponse(null, { status: 200 });
}
