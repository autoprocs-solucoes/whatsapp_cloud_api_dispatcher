// =============================================================================
// process-dispatch-queue — worker em background pra disparos de comunicado.
//
// Invocado por:
//  (a) pg_cron a cada minuto (fallback periódico)
//  (b) server action `executeDispatchAction` (kick imediato após enqueue)
//
// Por invocação:
//  - Promove 'scheduled' cuja hora chegou e lista até 10 dispatches
//    em status 'queued'|'running' ('paused' fica de fora de propósito)
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
// Classificação de erro da Meta
//
// O status HTTP sozinho não basta: a Cloud API devolve 400 tanto pra "número
// não existe no WhatsApp" (definitivo — insistir é desperdício e conta como
// spam) quanto pra "limite de throughput atingido" (temporário — insistir é
// exatamente o certo). Antes o worker só olhava 429/5xx, então todo rate limit
// que chegava como 400 virava falha permanente e a mensagem nunca saía.
//
// Referência: Cloud API — Error Codes.
// ---------------------------------------------------------------------------

/** Vale a pena tentar de novo: limite, instabilidade ou erro genérico da Meta. */
const RETRYABLE_META_CODES = new Set([
  1, // API Unknown — erro temporário do lado da Meta
  2, // API Service — serviço indisponível
  4, // Application request limit reached
  80007, // Rate limit issues
  130429, // Cloud API message throughput reached
  131000, // Something went wrong (genérico da Meta)
  131048, // Spam rate limit hit
  131056, // (Business, Consumer) pair rate limit hit
  133016, // Rate limit em restauração de conta
]);

/** Não adianta repetir: o problema é a mensagem, o número ou a conta. */
const PERMANENT_META_CODES = new Set([
  100, // Invalid parameter
  131008, // Required parameter is missing
  131021, // Recipient e sender são o mesmo número
  131026, // Message undeliverable (número não recebe / não existe)
  131047, // Re-engagement message (fora da janela de 24h)
  131049, // Meta optou por não entregar (saúde do ecossistema)
  131051, // Unsupported message type
  132000, // Template param count mismatch
  132001, // Template não existe
  132005, // Template texto muito longo
  132007, // Template format character policy violated
  132012, // Template parameter format mismatch
  132015, // Template pausado
  132016, // Template desabilitado
  133010, // Número não registrado
]);

/** Espera antes da próxima tentativa: 30s, 2min, 8min, 32min… com teto de 1h. */
function backoffSeconds(attempts: number): number {
  const base = 30 * Math.pow(4, Math.max(0, attempts - 1));
  const capped = Math.min(base, 3600);
  // Jitter de ±20% pra não sincronizar todos os destinatários do mesmo lote.
  return Math.round(capped * (0.8 + Math.random() * 0.4));
}

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

// Templates com HEADER format IMAGE não têm placeholder de texto (header_text
// null) mas exigem parâmetro de imagem em toda mensagem. Reaproveita o link
// do exemplo aprovado pela Meta (já hospedado no CDN da própria Meta).
function extractHeaderImageLink(componentsRaw: unknown): string | null {
  if (!Array.isArray(componentsRaw)) return null;
  for (const c of componentsRaw) {
    if (
      c &&
      typeof c === "object" &&
      (c as Record<string, unknown>).type === "HEADER" &&
      (c as Record<string, unknown>).format === "IMAGE"
    ) {
      const example = (c as Record<string, unknown>).example as
        | { header_handle?: unknown }
        | undefined;
      const handle = example?.header_handle;
      if (Array.isArray(handle) && typeof handle[0] === "string") {
        return handle[0];
      }
    }
  }
  return null;
}

// Templates com botão COPY_CODE ("Copiar código da oferta") exigem um
// componente `button` em toda mensagem com o código real — mesmo o código
// sendo fixo/aprovado no template (a Meta não injeta ele sozinha).
// Sem isso: (#131008) Required parameter is missing.
function extractCopyCodeButton(
  componentsRaw: unknown,
): { index: number; code: string } | null {
  if (!Array.isArray(componentsRaw)) return null;
  for (const c of componentsRaw) {
    if (c && typeof c === "object" && (c as Record<string, unknown>).type === "BUTTONS") {
      const buttons = (c as Record<string, unknown>).buttons;
      if (!Array.isArray(buttons)) continue;
      const idx = buttons.findIndex(
        (b) => b && typeof b === "object" && (b as Record<string, unknown>).type === "COPY_CODE",
      );
      if (idx === -1) continue;
      const btn = buttons[idx] as Record<string, unknown>;
      const example = btn.example;
      if (Array.isArray(example) && typeof example[0] === "string") {
        return { index: idx, code: example[0] };
      }
    }
  }
  return null;
}

type TplParam =
  | { type: "text"; text: string }
  | { type: "text"; parameter_name: string; text: string };

/**
 * Texto do template com as variáveis já trocadas — é o que vai pro espelho da
 * conversa, pra quem abrir o Conversas ver o que a pessoa recebeu, e não
 * "{{1}}".
 */
function renderBody(text: string | null, payload: Record<string, string>): string {
  if (!text) return "";
  return text.replace(
    /\{\{\s*([a-zA-Z_]\w*|\d+)\s*\}\}/g,
    (whole, key) => payload[`body:${key}`] ?? whole,
  );
}

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
  /** Código de erro da Meta (`error.code`), quando veio no corpo. */
  code: number | null;
  retriable: boolean;
  /** Rate limit: além de repetir, vale parar o disparo por esta invocação. */
  rateLimited: boolean;

  constructor(
    status: number,
    message: string,
    code: number | null = null,
    isTransient: boolean | null = null,
  ) {
    super(message);
    this.status = status;
    this.code = code;

    // Ordem de confiança:
    // 1. `is_transient` — a própria Meta dizendo se vale repetir. É o sinal
    //    mais confiável e não envelhece quando ela cria códigos novos.
    // 2. Listas de código conhecidas — cobrem o caso de `is_transient` ausente.
    // 3. Status HTTP — último recurso.
    if (isTransient !== null) {
      this.retriable = isTransient;
    } else if (code !== null && PERMANENT_META_CODES.has(code)) {
      this.retriable = false;
    } else if (code !== null && RETRYABLE_META_CODES.has(code)) {
      this.retriable = true;
    } else {
      this.retriable = status === 429 || status >= 500;
    }

    this.rateLimited =
      status === 429 ||
      (code !== null && [4, 80007, 130429, 131048, 131056].includes(code));
  }

  /** Código que vai pro banco: o da Meta quando existe, senão o HTTP. */
  get storedCode(): string {
    return String(this.code ?? this.status);
  }
}

// Reusar o link do exemplo aprovado (components_raw[].example.header_handle)
// como `image.link` não é confiável pra entrega — a Meta aceita a mensagem
// (devolve message id) mas ela falha silenciosamente depois. Baixa a imagem
// e faz upload via Cloud API pra ter um media id próprio (jeito suportado
// oficialmente). Chamado uma vez por dispatch, fora do loop de destinatários.
async function uploadMediaFromUrl(
  phoneNumberId: string,
  token: string,
  sourceUrl: string,
): Promise<string | null> {
  try {
    const imgRes = await fetch(sourceUrl);
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const blob = await imgRes.blob();

    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", contentType);
    form.append("file", blob, "header.jpg");

    const url =
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneNumberId}/media`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id ?? null;
  } catch {
    return null;
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
  headerImageId?: string | null;
  headerImageLink?: string | null;
  copyCodeButton?: { index: number; code: string } | null;
}): Promise<{ messageId: string }> {
  const components: Array<Record<string, unknown>> = [];
  if (args.headerImageId) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { id: args.headerImageId } }],
    });
  } else if (args.headerImageLink) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: args.headerImageLink } }],
    });
  } else if (args.headerParams.length > 0) {
    components.push({ type: "header", parameters: args.headerParams });
  }
  if (args.bodyParams.length > 0) {
    components.push({ type: "body", parameters: args.bodyParams });
  }
  if (args.copyCodeButton) {
    components.push({
      type: "button",
      sub_type: "copy_code",
      index: String(args.copyCodeButton.index),
      parameters: [{ type: "coupon_code", coupon_code: args.copyCodeButton.code }],
    });
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
    let code: number | null = null;
    let isTransient: boolean | null = null;
    try {
      const payload = await res.json();
      const err = payload?.error;
      code = typeof err?.code === "number" ? err.code : null;
      isTransient = typeof err?.is_transient === "boolean" ? err.is_transient : null;
      // `error_user_msg` é o texto que a Meta escreveu pro usuário final;
      // `error_data.details` traz o motivo específico. Ambos são melhores que
      // o `message` genérico pra quem vai ler isso na tela.
      const base = err?.error_user_msg ?? err?.message ?? msg;
      const details = err?.error_data?.details;
      msg = details && details !== base ? `${base} - ${details}` : base;
    } catch { /* ignore */ }
    throw new GraphError(res.status, msg, code, isTransient);
  }

  const data = await res.json();
  const id = data?.messages?.[0]?.id;
  if (!id) throw new GraphError(500, "Resposta sem message id");
  return { messageId: id };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Notificação de comunicado concluído
//
// Quem envia o push é a aplicação, não este worker: Web Push precisa de Node
// e aqui é Deno. Best-effort com timeout curto — o disparo já terminou, e
// falhar em avisar não pode reabrir nem travar nada.
// ---------------------------------------------------------------------------
const APP_URL = Deno.env.get("APP_URL") ?? Deno.env.get("NEXT_PUBLIC_APP_URL");

async function notifyDispatchFinished(dispatchId: string): Promise<void> {
  if (!APP_URL) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${APP_URL.replace(/\/+$/, "")}/api/internal/dispatch-finished`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ dispatchId }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn("[worker] notificacao respondeu", res.status);
    }
  } catch (e) {
    console.warn("[worker] notificacao falhou:", (e as Error).message);
  }
}

/**
 * Acorda os fluxos parados em bloco de atraso.
 *
 * Mora aqui de carona porque este worker já roda de minuto em minuto pelo
 * cron e já tem a service_role key no ambiente — assim o agendamento no banco
 * continua sendo um só, e nenhuma chave precisa ficar escrita dentro do
 * `cron.job`. O motor do fluxo em si é Node, por isso a chamada é pro app.
 */
async function tickFlows(): Promise<void> {
  if (!APP_URL) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${APP_URL.replace(/\/+$/, "")}/api/internal/flow-tick`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: "{}",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn("[worker] flow-tick respondeu", res.status);
    }
  } catch (e) {
    console.warn("[worker] flow-tick falhou:", (e as Error).message);
  }
}

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

  // Fluxos esperando a hora andam a cada invocação — independe de haver
  // transmissão na fila.
  await tickFlows();

  // Transmissão agendada cuja hora chegou entra na fila agora. Roda antes da
  // listagem pra ela já ser pega nesta mesma invocação.
  const { error: promoteErr } = await admin
    .from("dispatch")
    .update({ status: "queued" })
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());
  if (promoteErr) {
    console.error("[worker] falha promovendo agendadas", promoteErr);
  }

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
    {
      sent: number;
      failed: number;
      retrying: number;
      left: number;
      rateLimitHit: boolean;
      finalStatus?: string;
    }
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

    // Carrega template em paralelo com o phone number (pra achar a
    // connection/WABA dona desse número — um workspace pode ter várias
    // contas Meta conectadas, cada uma com seu próprio access_token).
    const [tplRes, phoneRes] = await Promise.all([
      admin
        .from("template")
        .select("*")
        .eq("id", dispatch.template_id)
        .maybeSingle(),
      admin
        .from("workspace_phone_number")
        .select("connection_id")
        .eq("workspace_id", dispatch.workspace_id)
        .eq("phone_number_id", dispatch.phone_number_id)
        .maybeSingle(),
    ]);

    const template = tplRes.data;
    const connection = phoneRes.data
      ? (
          await admin
            .from("workspace_meta_connection")
            .select("id, access_token")
            .eq("id", phoneRes.data.connection_id)
            .maybeSingle()
        ).data
      : null;

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
        retrying: 0,
        left: 0,
        rateLimitHit: false,
        finalStatus: "failed",
      };
      continue;
    }

    const headerPlaceholders = extractPlaceholders(template.header_text);
    const bodyPlaceholders = extractPlaceholders(template.body_text);
    const headerImageLink = extractHeaderImageLink(template.components_raw);
    // Upload uma vez por dispatch (não por destinatário) — o media id é
    // reaproveitado em todos os envios deste template neste dispatch.
    const headerImageId = headerImageLink
      ? await uploadMediaFromUrl(
        dispatch.phone_number_id,
        connection.access_token,
        headerImageLink,
      )
      : null;
    const copyCodeButton = extractCopyCodeButton(template.components_raw);

    let sent = 0;
    let failed = 0;
    let retrying = 0;
    // Rate limit é do número, não do destinatário: insistir nos próximos da
    // fila só piora. Ao bater, larga este dispatch e deixa o backoff cuidar.
    let rateLimitHit = false;

    while (totalProcessed < MAX_PER_INVOCATION && !rateLimitHit) {
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
        contact_id: string | null;
        phone_e164: string;
        payload: Record<string, string> | null;
        attempts: number;
      }>;
      if (batch.length === 0) break;

      // Espelho da conversa: uma linha por mensagem que sai, gravada em bloco
      // no fim do lote. Sem isso a transmissão não abria conversa nenhuma no
      // Conversas — a thread só nascia se a pessoa respondesse.
      const mirrorRows: Array<Record<string, unknown>> = [];

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
            headerImageId,
            headerImageLink: headerImageId ? null : headerImageLink,
            copyCodeButton,
          });
          const sentAt = new Date().toISOString();
          await admin
            .from("dispatch_recipient")
            .update({
              status: "sent",
              meta_message_id: messageId,
              sent_at: sentAt,
            })
            .eq("id", r.id);

          mirrorRows.push({
            workspace_id: dispatch.workspace_id,
            connection_id: connection.id,
            phone_number_id: dispatch.phone_number_id,
            contact_phone_e164: r.phone_e164.startsWith("+")
              ? r.phone_e164
              : `+${r.phone_e164}`,
            contact_id: r.contact_id,
            contact_name: null,
            direction: "out",
            type: "template",
            body: renderBody(template.body_text, payload) || template.name,
            meta_message_id: messageId,
            status: "sent",
            read_internally: true,
            sent_at: sentAt,
          });

          sent++;
        } catch (e) {
          const err = e as GraphError;
          // `attempts` já foi incrementado pelo claim, então este é o número de
          // tentativas gastas até aqui.
          const willRetry = err?.retriable === true && r.attempts < MAX_ATTEMPTS;

          if (willRetry) {
            // Volta pra fila com espera crescente. Grava o erro mesmo assim:
            // sem isso o destinatário fica "na fila" sem explicação nenhuma.
            await admin.rpc("reschedule_dispatch_recipient", {
              p_id: r.id,
              p_delay_seconds: backoffSeconds(r.attempts),
              p_error_code: err.storedCode,
              p_error_message: `Tentativa ${r.attempts}/${MAX_ATTEMPTS}: ${err.message}`,
            });
            retrying++;
            if (err.rateLimited) rateLimitHit = true;
          } else {
            const exhausted = err?.retriable === true;
            await admin
              .from("dispatch_recipient")
              .update({
                status: "failed",
                error_code: String(err?.storedCode ?? "exception"),
                error_message: (exhausted
                  ? `Desistiu após ${MAX_ATTEMPTS} tentativas: ${err?.message ?? ""}`
                  : String(err?.message ?? "")
                ).slice(0, 500),
                failed_at: new Date().toISOString(),
                last_error_at: new Date().toISOString(),
              })
              .eq("id", r.id);
            failed++;
          }
        }

        totalProcessed++;
        if (INTER_MESSAGE_DELAY_MS > 0) await sleep(INTER_MESSAGE_DELAY_MS);
      }

      // Em bloco, não uma por envio: 200 inserts separados custariam mais que
      // o próprio disparo. Falhar aqui não derruba nada — a mensagem já saiu.
      if (mirrorRows.length > 0) {
        const { error: mirrorErr } = await admin.from("whatsapp_message").insert(mirrorRows);
        if (mirrorErr) {
          console.error("[worker] espelho da conversa falhou", mirrorErr.message);
        }
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
      // Sucesso = ao menos um destinatário saiu. Precisa contar delivered e
      // read também: o webhook da Meta promove 'sent' assim que a mensagem
      // chega, então num disparo rápido e bem-sucedido a contagem de 'sent'
      // pode ser zero aqui — e o comunicado inteiro era marcado como 'failed'.
      const { count: deliveredCount } = await admin
        .from("dispatch_recipient")
        .select("*", { count: "exact", head: true })
        .eq("dispatch_id", dispatch.id)
        .in("status", ["sent", "delivered", "read"]);

      finalStatus = (deliveredCount ?? 0) > 0 ? "done" : "failed";
      const { error: finishError } = await admin
        .from("dispatch")
        .update({
          status: finalStatus,
          finished_at: new Date().toISOString(),
        })
        .eq("id", dispatch.id)
        // Só quem de fato virou a chave notifica. Sem isso, duas invocações
        // simultâneas mandariam a mesma notificação duas vezes.
        .in("status", ["queued", "running"]);

      if (!finishError) {
        await notifyDispatchFinished(dispatch.id);
      }
    }

    report[dispatch.id] = { sent, failed, retrying, left, rateLimitHit, finalStatus };
  }

  return new Response(
    JSON.stringify({ processed: totalProcessed, dispatches: report }),
    { headers: { "Content-Type": "application/json" } },
  );
});
