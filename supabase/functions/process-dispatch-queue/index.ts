// =============================================================================
// process-dispatch-queue — worker em background pra disparos de comunicado.
//
// Invocado por:
//  (a) pg_cron a cada minuto (fallback periódico)
//  (b) server action `executeDispatchAction` (kick imediato após enqueue)
//
// Por invocação:
//  - Lista até 10 dispatches em status 'queued'|'running'
//  - Pra cada um, faz claim atômico de até BATCH_SIZE recipients via RPC
//  - Envia via WhatsApp Cloud API e atualiza dispatch_recipient
//  - Para quando hit MAX_PER_INVOCATION ou não há mais queued
//  - Marca dispatch como 'done'|'failed' quando count(queued)=0
//
// Idempotente: cron seguinte continua de onde parou.
// Concorrência segura: claim usa FOR UPDATE SKIP LOCKED.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_GRAPH_API_VERSION =
  Deno.env.get("META_GRAPH_API_VERSION") ?? "v21.0";

const MAX_PER_INVOCATION = 200;
const BATCH_SIZE = 25;
const INTER_MESSAGE_DELAY_MS = 200;
const MAX_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Util: extrai placeholders {{name}} / {{1}} (espelha src/lib/meta/placeholders)
// ---------------------------------------------------------------------------
function extractPlaceholders(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\{\{\s*([a-zA-Z_]\w*|\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1]!;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  if (out.every((p) => /^\d+$/.test(p))) {
    out.sort((a, b) => Number(a) - Number(b));
  }
  return out;
}

function isNamed(p: string): boolean {
  return !/^\d+$/.test(p);
}

type TplParam =
  | { type: "text"; text: string }
  | { type: "text"; parameter_name: string; text: string };

function buildParams(
  placeholders: string[],
  payload: Record<string, string>,
  component: "header" | "body",
): TplParam[] {
  return placeholders.map((p) => {
    const text = payload[`${component}:${p}`] ?? "";
    return isNamed(p)
      ? { type: "text", parameter_name: p, text }
      : { type: "text", text };
  });
}

// ---------------------------------------------------------------------------
// Meta send
// ---------------------------------------------------------------------------
class GraphError extends Error {
  status: number;
  retriable: boolean;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.retriable = status === 429 || status >= 500;
  }
}

async function sendTemplate(args: {
  phoneNumberId: string;
  to: string;
  token: string;
  templateName: string;
  language: string;
  headerParams: TplParam[];
  bodyParams: TplParam[];
}): Promise<{ messageId: string }> {
  const components: Array<Record<string, unknown>> = [];
  if (args.headerParams.length > 0) {
    components.push({ type: "header", parameters: args.headerParams });
  }
  if (args.bodyParams.length > 0) {
    components.push({ type: "body", parameters: args.bodyParams });
  }

  const body = {
    messaging_product: "whatsapp",
    to: args.to,
    type: "template",
    template: {
      name: args.templateName,
      language: { code: args.language },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  const url =
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${args.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `Graph error ${res.status}`;
    try {
      const payload = await res.json();
      msg = payload?.error?.message ?? msg;
    } catch { /* ignore */ }
    throw new GraphError(res.status, msg);
  }

  const data = await res.json();
  const id = data?.messages?.[0]?.id;
  if (!id) throw new GraphError(500, "Resposta sem message id");
  return { messageId: id };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (_req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL / SERVICE_ROLE_KEY missing" }),
      { status: 500 },
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Lista dispatches ativos. 10 é teto razoável por invocação.
  const { data: dispatches, error: dispErr } = await admin
    .from("dispatch")
    .select("*")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(10);

  if (dispErr) {
    return new Response(JSON.stringify({ error: dispErr.message }), {
      status: 500,
    });
  }

  let totalProcessed = 0;
  const report: Record<
    string,
    { sent: number; failed: number; left: number; finalStatus?: string }
  > = {};

  for (const dispatch of dispatches ?? []) {
    if (totalProcessed >= MAX_PER_INVOCATION) break;

    // Flip queued → running.
    if (dispatch.status === "queued") {
      await admin
        .from("dispatch")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", dispatch.id)
        .eq("status", "queued");
    }

    // Carrega template + token Meta em paralelo.
    const [tplRes, connRes] = await Promise.all([
      admin
        .from("template")
        .select("*")
        .eq("id", dispatch.template_id)
        .maybeSingle(),
      admin
        .from("workspace_meta_connection")
        .select("access_token")
        .eq("workspace_id", dispatch.workspace_id)
        .maybeSingle(),
    ]);

    const template = tplRes.data;
    const connection = connRes.data;

    if (!template || !connection) {
      await admin
        .from("dispatch")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
        })
        .eq("id", dispatch.id);
      report[dispatch.id] = {
        sent: 0,
        failed: 0,
        left: 0,
        finalStatus: "failed",
      };
      continue;
    }

    const headerPlaceholders = extractPlaceholders(template.header_text);
    const bodyPlaceholders = extractPlaceholders(template.body_text);

    let sent = 0;
    let failed = 0;

    while (totalProcessed < MAX_PER_INVOCATION) {
      const { data: claimed, error: claimErr } = await admin.rpc(
        "claim_dispatch_recipients",
        { p_dispatch_id: dispatch.id, p_limit: BATCH_SIZE },
      );
      if (claimErr) {
        console.error("[worker] claim error", dispatch.id, claimErr);
        break;
      }
      const batch = (claimed ?? []) as Array<{
        id: string;
        phone_e164: string;
        payload: Record<string, string> | null;
        attempts: number;
      }>;
      if (batch.length === 0) break;

      for (const r of batch) {
        if (totalProcessed >= MAX_PER_INVOCATION) break;
        const payload = (r.payload ?? {}) as Record<string, string>;
        const headerParams = buildParams(headerPlaceholders, payload, "header");
        const bodyParams = buildParams(bodyPlaceholders, payload, "body");

        try {
          const { messageId } = await sendTemplate({
            phoneNumberId: dispatch.phone_number_id,
            to: r.phone_e164,
            token: connection.access_token,
            templateName: template.name,
            language: template.language,
            headerParams,
            bodyParams,
          });
          await admin
            .from("dispatch_recipient")
            .update({
              status: "sent",
              meta_message_id: messageId,
              sent_at: new Date().toISOString(),
            })
            .eq("id", r.id);
          sent++;
        } catch (e) {
          const err = e as GraphError;
          const retriable = err?.retriable && r.attempts < MAX_ATTEMPTS;
          if (retriable) {
            // Não mexe em status — claimed_at expira no stale interval e
            // próxima rodada pega de novo.
            console.warn(
              "[worker] retriable error",
              dispatch.id,
              r.id,
              err?.status,
              err?.message,
            );
          } else {
            await admin
              .from("dispatch_recipient")
              .update({
                status: "failed",
                error_code: String(err?.status ?? "exception"),
                error_message: String(err?.message ?? "").slice(0, 500),
                failed_at: new Date().toISOString(),
              })
              .eq("id", r.id);
            failed++;
          }
        }

        totalProcessed++;
        if (INTER_MESSAGE_DELAY_MS > 0) await sleep(INTER_MESSAGE_DELAY_MS);
      }
    }

    // Resta queued no dispatch?
    const { count: leftCount } = await admin
      .from("dispatch_recipient")
      .select("*", { count: "exact", head: true })
      .eq("dispatch_id", dispatch.id)
      .eq("status", "queued");

    const left = leftCount ?? 0;
    let finalStatus: string | undefined;

    if (left === 0) {
      // Determina sucesso: ao menos 1 sent → done; senão failed.
      const { count: sentCount } = await admin
        .from("dispatch_recipient")
        .select("*", { count: "exact", head: true })
        .eq("dispatch_id", dispatch.id)
        .eq("status", "sent");

      finalStatus = (sentCount ?? 0) > 0 ? "done" : "failed";
      await admin
        .from("dispatch")
        .update({
          status: finalStatus,
          finished_at: new Date().toISOString(),
        })
        .eq("id", dispatch.id);
    }

    report[dispatch.id] = { sent, failed, left, finalStatus };
  }

  return new Response(
    JSON.stringify({ processed: totalProcessed, dispatches: report }),
    { headers: { "Content-Type": "application/json" } },
  );
});
