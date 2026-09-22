"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  SpreadsheetParseError,
  detectAutoMapping,
  parseSpreadsheet,
} from "@/lib/import/parse-spreadsheet";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/server/workspace";
import { getConnectionForPhoneNumber } from "@/server/meta";
import { env, serverEnv } from "@/lib/env";
import {
  GraphApiError,
  extractPlaceholders,
  sendTemplate,
  uploadMediaFromUrl,
  type TemplateParameter,
} from "@/lib/meta/graph-api";
import {
  extractCopyCodeButton,
  extractHeaderImageLink,
  isNamedPlaceholder,
} from "@/lib/meta/placeholders";
import { normalizeBR } from "@/lib/phone/e164";
import {
  createDispatchSchema,
  executeDispatchSchema,
  testSendSchema,
  variableMappingSchema,
  type CreateDispatchInput,
  type VariableMapping,
} from "@/features/dispatch/schemas";
import {
  resolveFromManual,
  resolveFromSegment,
  resolveVariables,
  type ResolvedRecipient,
  type ResolveStats,
} from "@/features/dispatch/resolver";
import type {
  Dispatch,
  DispatchRecipient,
  Template,
} from "@/lib/supabase/database.types";
import type { TimelineDay } from "@/features/dashboard/queries";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function ensureMember(): Promise<{ workspaceId: string; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const workspace = await requireActiveWorkspace();
  return { workspaceId: workspace.id, userId: user.id };
}

function parseMappingField(raw: FormDataEntryValue | null): VariableMapping | null {
  if (typeof raw !== "string" || raw.length === 0) return {};
  try {
    return variableMappingSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function buildParameters(
  placeholders: string[],
  resolved: Record<string, string>,
  component: "header" | "body",
): TemplateParameter[] {
  return placeholders.map((p) => {
    const text = resolved[`${component}:${p}`] ?? "";
    return isNamedPlaceholder(p) ? { name: p, text } : { text };
  });
}

function parseManualPhones(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function resolveRecipients(
  workspaceId: string,
  input: CreateDispatchInput,
): Promise<{ recipients: ResolvedRecipient[]; stats: ResolveStats }> {
  if (input.recipient_source === "segment" && input.segment_id) {
    return resolveFromSegment(workspaceId, input.segment_id);
  }
  if (input.recipient_source === "manual") {
    return resolveFromManual(workspaceId, input.manual_phones);
  }
  return {
    recipients: [],
    stats: { resolved: 0, filtered_opt_out: 0, invalid_phones: 0, unknown_phones: 0 },
  };
}

async function loadTemplate(
  workspaceId: string,
  templateId: string,
): Promise<Template | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("template")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", templateId)
    .maybeSingle();
  return data ?? null;
}

// ----------------------------------------------------------------------------
// Lista + get
// ----------------------------------------------------------------------------
export type DispatchListItem = Dispatch & {
  template_name: string | null;
  segment_name: string | null;
  campaign_name: string | null;
  counts: Record<string, number>;
};

export async function listDispatches(): Promise<DispatchListItem[]> {
  const ctx = await ensureMember();
  if (!ctx) return [];

  const admin = createAdminClient();
  const { data: dispatches } = await admin
    .from("dispatch")
    .select("*, template:template_id(name), segment:segment_id(name), campaign:campaign_id(name)")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!dispatches || dispatches.length === 0) return [];

  const ids = dispatches.map((d) => d.id);
  const { data: recipients } = await admin
    .from("dispatch_recipient")
    .select("dispatch_id, status")
    .in("dispatch_id", ids);

  const byDispatch: Record<string, Record<string, number>> = {};
  (recipients ?? []).forEach((r) => {
    const m = byDispatch[r.dispatch_id] ?? {};
    m[r.status] = (m[r.status] ?? 0) + 1;
    byDispatch[r.dispatch_id] = m;
  });

  return dispatches.map((d) => {
    const tpl = (d as { template?: { name: string } | null }).template;
    const seg = (d as { segment?: { name: string } | null }).segment;
    const camp = (d as { campaign?: { name: string } | null }).campaign;
    return {
      ...d,
      template: undefined,
      segment: undefined,
      campaign: undefined,
      template_name: tpl?.name ?? null,
      segment_name: seg?.name ?? null,
      campaign_name: camp?.name ?? null,
      counts: byDispatch[d.id] ?? {},
    } as DispatchListItem;
  });
}

export type DispatchErrorGroup = {
  error_code: string | null;
  error_message: string | null;
  count: number;
};

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

// Bucketiza os envios da transmissão por dia (mesma lógica exclusiva do
// dashboard: cada recipient conta uma vez, no estágio terminal atingido).
// Janela = do primeiro ao último dia com atividade nessa transmissão (não fixa
// em 30 dias, já que uma transmissão normalmente é bem mais curta que isso).
// Falhas no envio (rejeitadas na hora, sem sent_at) usam failed_at como data.
function buildDispatchTimeline(
  rows: { status: string; sent_at: string | null; failed_at: string | null }[],
): TimelineDay[] {
  const dated = rows
    .map((r) => ({ status: r.status, eventDate: r.sent_at ?? r.failed_at }))
    .filter((r): r is { status: string; eventDate: string } => !!r.eventDate);
  if (dated.length === 0) return [];

  const keys = dated.map((r) => dateKey(r.eventDate));
  const minKey = keys.reduce((a, b) => (a < b ? a : b));
  const maxKey = keys.reduce((a, b) => (a > b ? a : b));

  const map = new Map<string, TimelineDay>();
  const cursor = new Date(`${minKey}T00:00:00`);
  const end = new Date(`${maxKey}T00:00:00`);
  while (cursor <= end) {
    const key = dateKey(cursor.toISOString());
    map.set(key, { date: key, sent: 0, delivered: 0, read: 0, failed: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  dated.forEach((r) => {
    const day = map.get(dateKey(r.eventDate));
    if (!day) return;
    if (r.status === "sent") day.sent++;
    else if (r.status === "delivered") {
      day.sent++;
      day.delivered++;
    } else if (r.status === "read") {
      day.sent++;
      day.delivered++;
      day.read++;
    } else if (r.status === "failed") day.failed++;
  });

  return Array.from(map.values());
}

function buildErrorGroups(
  rows: { status: string; error_code: string | null; error_message: string | null }[],
): DispatchErrorGroup[] {
  const groups = new Map<string, DispatchErrorGroup>();
  rows.forEach((r) => {
    if (r.status !== "failed") return;
    const key = `${r.error_code ?? ""}|${r.error_message ?? ""}`;
    const existing = groups.get(key);
    if (existing) existing.count++;
    else
      groups.set(key, {
        error_code: r.error_code,
        error_message: r.error_message,
        count: 1,
      });
  });
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

export type DispatchDetail = {
  dispatch: Dispatch;
  template: Template | null;
  recipients: DispatchRecipient[];
  totalRecipients: number;
  counts: Record<string, number>;
  reactionCount: number;
  timeline: TimelineDay[];
  errorGroups: DispatchErrorGroup[];
};

export async function getDispatch(
  id: string,
  opts: { page?: number; pageSize?: number; statusFilter?: string } = {},
): Promise<DispatchDetail | null> {
  const ctx = await ensureMember();
  if (!ctx) return null;

  const admin = createAdminClient();
  const { data: dispatch } = await admin
    .from("dispatch")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (!dispatch) return null;

  const template = await loadTemplate(ctx.workspaceId, dispatch.template_id);

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let recipientsQ = admin
    .from("dispatch_recipient")
    .select("*", { count: "exact" })
    .eq("dispatch_id", id)
    .order("phone_e164", { ascending: true });

  if (opts.statusFilter && opts.statusFilter !== "all") {
    recipientsQ = recipientsQ.eq(
      "status",
      opts.statusFilter as DispatchRecipient["status"],
    );
  }

  const { data: recipients, count } = await recipientsQ.range(from, to);

  const { data: allRows } = await admin
    .from("dispatch_recipient")
    .select("status, sent_at, failed_at, error_code, error_message")
    .eq("dispatch_id", id);

  const counts: Record<string, number> = {};
  (allRows ?? []).forEach((r) => {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  });

  const { count: reactionCount } = await admin
    .from("dispatch_recipient")
    .select("*", { count: "exact", head: true })
    .eq("dispatch_id", id)
    .not("reaction_emoji", "is", null);

  return {
    dispatch,
    template,
    recipients: recipients ?? [],
    totalRecipients: count ?? 0,
    counts,
    reactionCount: reactionCount ?? 0,
    timeline: buildDispatchTimeline(allRows ?? []),
    errorGroups: buildErrorGroups(allRows ?? []),
  };
}

// ----------------------------------------------------------------------------
// Configs de um dispatch existente p/ pré-preencher wizard (duplicar).
// Retorna só os campos do form, sem recipients/status — usuário re-resolve.
// ----------------------------------------------------------------------------
export type DispatchPreset = {
  template_id: string;
  phone_number_id: string;
  recipient_source: "segment" | "manual";
  segment_id: string | null;
  manual_phones: string[];
  variable_mapping: VariableMapping;
};

export async function getDispatchPreset(id: string): Promise<DispatchPreset | null> {
  const ctx = await ensureMember();
  if (!ctx) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("dispatch")
    .select(
      "template_id, phone_number_id, recipient_source, segment_id, manual_phones, variable_mapping",
    )
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const mapping = variableMappingSchema.safeParse(data.variable_mapping ?? {});
  return {
    template_id: data.template_id,
    phone_number_id: data.phone_number_id,
    recipient_source: data.recipient_source as DispatchPreset["recipient_source"],
    segment_id: data.segment_id ?? null,
    manual_phones: data.manual_phones ?? [],
    variable_mapping: mapping.success ? mapping.data : {},
  };
}

// ----------------------------------------------------------------------------
// Preview recipients (estimativa antes do confirm)
// ----------------------------------------------------------------------------
export async function previewRecipientsAction(
  formData: FormData,
): Promise<ActionResult<{ stats: ResolveStats; sampleRecipients: ResolvedRecipient[] }>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const parsed = createDispatchSchema.safeParse({
    template_id: formData.get("template_id"),
    phone_number_id: formData.get("phone_number_id"),
    name: formData.get("name") ?? "",
    campaign_id: formData.get("campaign_id") || null,
    scheduled_at: formData.get("scheduled_at") ?? "",
    recipient_source: formData.get("recipient_source"),
    segment_id: formData.get("segment_id") || null,
    manual_phones: parseManualPhones(formData.get("manual_phones")),
    variable_mapping: parseMappingField(formData.get("variable_mapping")) ?? {},
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { recipients, stats } = await resolveRecipients(ctx.workspaceId, parsed.data);
  return {
    ok: true,
    data: {
      stats,
      sampleRecipients: recipients.slice(0, 10),
    },
  };
}

// ----------------------------------------------------------------------------
// Test send (uma mensagem só, sem persistir dispatch_recipient)
// ----------------------------------------------------------------------------
export async function testSendAction(formData: FormData): Promise<ActionResult<{ messageId: string }>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const parsed = testSendSchema.safeParse({
    template_id: formData.get("template_id"),
    phone_number_id: formData.get("phone_number_id"),
    to_phone: formData.get("to_phone"),
    variable_mapping: parseMappingField(formData.get("variable_mapping")) ?? {},
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const norm = normalizeBR(parsed.data.to_phone);
  if (!norm.ok) return { ok: false, error: `Telefone inválido: ${norm.reason}` };

  const template = await loadTemplate(ctx.workspaceId, parsed.data.template_id);
  if (!template) return { ok: false, error: "Template não encontrado" };
  if (!template.active) {
    return { ok: false, error: "Template desativado pelo owner" };
  }

  const connection = await getConnectionForPhoneNumber(ctx.workspaceId, parsed.data.phone_number_id);
  if (!connection) return { ok: false, error: "Número remetente sem conexão Meta" };

  const headerPlaceholders = extractPlaceholders(template.header_text);
  const bodyPlaceholders = extractPlaceholders(template.body_text);

  const syntheticRecipient: ResolvedRecipient = {
    contact_id: null,
    phone_e164: norm.e164,
    full_name: null,
    custom_fields: {},
  };
  const resolved = resolveVariables(syntheticRecipient, parsed.data.variable_mapping);
  const headerParameters = buildParameters(headerPlaceholders, resolved, "header");
  const bodyParameters = buildParameters(bodyPlaceholders, resolved, "body");
  const headerImageLink = extractHeaderImageLink(template.components_raw);
  const copyCodeButton = extractCopyCodeButton(template.components_raw) ?? undefined;
  let headerImageId: string | undefined;
  if (headerImageLink) {
    try {
      const uploaded = await uploadMediaFromUrl(
        parsed.data.phone_number_id,
        connection.access_token,
        headerImageLink,
      );
      headerImageId = uploaded.id;
    } catch {
      // Upload falhou — cai pro link direto como fallback (menos confiável,
      // mas melhor que não enviar nada).
    }
  }

  try {
    const r = await sendTemplate({
      phoneNumberId: parsed.data.phone_number_id,
      to: norm.e164,
      token: connection.access_token,
      templateName: template.name,
      language: template.language,
      headerParameters,
      bodyParameters,
      headerImageId,
      headerImageLink: headerImageId ? undefined : (headerImageLink ?? undefined),
      copyCodeButton,
    });
    return { ok: true, data: { messageId: r.messageId } };
  } catch (e) {
    if (e instanceof GraphApiError) return { ok: false, error: `Meta: ${e.message}` };
    return { ok: false, error: "Falha no envio" };
  }
}

// ----------------------------------------------------------------------------
// Create dispatch (persiste como draft + recipients queued)
// ----------------------------------------------------------------------------
export async function createDispatchAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; stats: ResolveStats }>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const parsed = createDispatchSchema.safeParse({
    template_id: formData.get("template_id"),
    phone_number_id: formData.get("phone_number_id"),
    name: formData.get("name") ?? "",
    campaign_id: formData.get("campaign_id") || null,
    scheduled_at: formData.get("scheduled_at") ?? "",
    recipient_source: formData.get("recipient_source"),
    segment_id: formData.get("segment_id") || null,
    manual_phones: parseManualPhones(formData.get("manual_phones")),
    variable_mapping: parseMappingField(formData.get("variable_mapping")) ?? {},
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const template = await loadTemplate(ctx.workspaceId, parsed.data.template_id);
  if (!template) return { ok: false, error: "Template não encontrado" };
  if (template.status !== "APPROVED") {
    return { ok: false, error: "Template não está aprovado" };
  }
  if (!template.active) {
    return { ok: false, error: "Template desativado pelo owner" };
  }

  const { recipients, stats } = await resolveRecipients(ctx.workspaceId, parsed.data);
  if (recipients.length === 0) {
    return { ok: false, error: "Nenhum destinatário válido após filtros" };
  }

  const admin = createAdminClient();
  const { data: dispatch, error: insertErr } = await admin
    .from("dispatch")
    .insert({
      workspace_id: ctx.workspaceId,
      template_id: parsed.data.template_id,
      phone_number_id: parsed.data.phone_number_id,
      name: parsed.data.name || null,
      campaign_id: parsed.data.campaign_id,
      // Guarda como instante absoluto; o worker compara com now() do banco.
      scheduled_at: parsed.data.scheduled_at
        ? new Date(parsed.data.scheduled_at).toISOString()
        : null,
      segment_id: parsed.data.segment_id ?? null,
      recipient_source: parsed.data.recipient_source,
      manual_phones: parsed.data.manual_phones,
      variable_mapping: parsed.data.variable_mapping as never,
      status: "draft",
      total_recipients: recipients.length,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (insertErr || !dispatch) {
    return { ok: false, error: insertErr?.message ?? "Falha criando transmissão" };
  }

  const recipientRows = recipients.map((r) => ({
    dispatch_id: dispatch.id,
    contact_id: r.contact_id,
    phone_e164: r.phone_e164,
    payload: resolveVariables(r, parsed.data.variable_mapping) as never,
    status: "queued" as const,
  }));

  const BATCH = 500;
  for (let i = 0; i < recipientRows.length; i += BATCH) {
    const batch = recipientRows.slice(i, i + BATCH);
    const { error } = await admin.from("dispatch_recipient").insert(batch);
    if (error) {
      return { ok: false, error: `Falha inserindo destinatários: ${error.message}` };
    }
  }

  revalidatePath("/transmissao");
  return { ok: true, data: { id: dispatch.id, stats } };
}

// ----------------------------------------------------------------------------
// Enqueue dispatch (marca como `queued` e kicka worker da Edge Function).
// Worker (supabase/functions/process-dispatch-queue) processa em background;
// pg_cron garante continuidade mesmo se o kick falhar.
// ----------------------------------------------------------------------------
function getWorkerUrl(): string | null {
  // NEXT_PUBLIC_SUPABASE_URL é tipo https://<ref>.supabase.co
  const base = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/functions/v1/process-dispatch-queue`;
}

async function kickWorker(): Promise<void> {
  const url = getWorkerUrl();
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    // Fire-and-forget com timeout curto: se o worker estiver lento, voltamos
    // pra UI sem bloquear. Cron garante que continua sendo processado.
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1500);
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: "{}",
      signal: controller.signal,
    })
      .catch(() => {
        /* ok — cron pega no próximo minuto */
      })
      .finally(() => clearTimeout(t));
  } catch {
    /* idem */
  }
}

export async function executeDispatchAction(
  formData: FormData,
): Promise<ActionResult<{ status: Dispatch["status"]; queued: number }>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const parsed = executeDispatchSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const admin = createAdminClient();

  const { data: dispatch } = await admin
    .from("dispatch")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!dispatch) return { ok: false, error: "Transmissão não encontrada" };
  if (dispatch.status !== "draft") {
    return { ok: false, error: `Transmissão já está ${dispatch.status}` };
  }

  // Validações antes de enfileirar — pra dar erro síncrono cedo.
  const template = await loadTemplate(ctx.workspaceId, dispatch.template_id);
  if (!template) return { ok: false, error: "Template da transmissão não existe mais" };

  const connection = await getConnectionForPhoneNumber(ctx.workspaceId, dispatch.phone_number_id);
  if (!connection) return { ok: false, error: "Número remetente sem conexão Meta" };

  // Agendada pra frente entra como `scheduled`: o worker promove pra `queued`
  // quando a hora chegar, em vez de sair enviando agora.
  const scheduledAhead =
    dispatch.scheduled_at !== null && new Date(dispatch.scheduled_at).getTime() > Date.now();
  const nextStatus = scheduledAhead ? ("scheduled" as const) : ("queued" as const);

  // Transição atômica draft → queued/scheduled. Se 0 linhas, outro request já
  // enfileirou.
  const { data: locked, error: lockErr } = await admin
    .from("dispatch")
    .update({ status: nextStatus })
    .eq("id", dispatch.id)
    .eq("status", "draft")
    .select("id");
  if (lockErr) return { ok: false, error: `Falha ao enfileirar: ${lockErr.message}` };
  if (!locked || locked.length === 0) {
    return { ok: false, error: "Transmissão já está sendo executada" };
  }

  const { count: queued } = await admin
    .from("dispatch_recipient")
    .select("*", { count: "exact", head: true })
    .eq("dispatch_id", dispatch.id)
    .eq("status", "queued");

  // Kick imediato no worker — não-bloqueante. Agendada não precisa: o cron
  // chama o worker de tempos em tempos e ele promove na hora certa.
  if (!scheduledAhead) void kickWorker();

  revalidatePath("/transmissao");
  revalidatePath(`/transmissao/${dispatch.id}`);
  return { ok: true, data: { status: nextStatus, queued: queued ?? 0 } };
}

// ----------------------------------------------------------------------------
// Controle da transmissão em andamento: pausar, retomar e parar.
// O worker só olha `queued`/`running`, então pausar é mudar o status — o que
// sobrou na fila fica esperando e nada mais é reivindicado.
// ----------------------------------------------------------------------------

type DispatchStatus = Dispatch["status"];

async function transitionDispatch(
  id: string,
  from: DispatchStatus[],
  to: "paused" | "queued" | "canceled",
): Promise<ActionResult<{ status: string }>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const admin = createAdminClient();
  const patch =
    to === "canceled"
      ? { status: to, finished_at: new Date().toISOString() }
      : { status: to };

  const { data, error } = await admin
    .from("dispatch")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .in("status", from)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "A transmissão não está mais nesse estado" };
  }

  if (to === "queued") void kickWorker();

  revalidatePath("/transmissao");
  revalidatePath(`/transmissao/${id}`);
  return { ok: true, data: { status: to } };
}

export async function pauseDispatchAction(id: string) {
  return transitionDispatch(id, ["queued", "running", "scheduled"], "paused");
}

export async function resumeDispatchAction(id: string) {
  return transitionDispatch(id, ["paused"], "queued");
}

/** Parar de vez: o que não saiu não sai mais. */
export async function cancelDispatchAction(id: string) {
  return transitionDispatch(id, ["draft", "scheduled", "queued", "running", "paused"], "canceled");
}

/** Muda a hora marcada de uma transmissão que ainda não começou. */
export async function rescheduleDispatchAction(
  id: string,
  scheduledAt: string,
): Promise<ActionResult> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const when = scheduledAt ? new Date(scheduledAt) : null;
  if (when && Number.isNaN(when.getTime())) {
    return { ok: false, error: "Data inválida" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dispatch")
    .update({
      scheduled_at: when ? when.toISOString() : null,
      status: when && when.getTime() > Date.now() ? "scheduled" : "queued",
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .in("status", ["scheduled", "queued", "paused"])
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Só dá pra remarcar transmissão que ainda não terminou" };
  }

  revalidatePath("/transmissao");
  revalidatePath(`/transmissao/${id}`);
  return { ok: true, data: undefined };
}


/**
 * Público por planilha: lê o .xlsx/.csv e devolve os telefones da coluna que
 * parecer ser a de contato. Não cadastra ninguém — a transmissão manda pra
 * lista como ela veio, e quem quiser virar contato entra por Contatos →
 * Importar.
 */
export async function extractPhonesFromSpreadsheetAction(
  formData: FormData,
): Promise<ActionResult<{ phones: string[]; column: string; total: number }>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione uma planilha" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "Planilha muito grande (máx. 10MB)" };
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = await parseSpreadsheet(buffer, file.name, file.type);
  } catch (e) {
    if (e instanceof SpreadsheetParseError) return { ok: false, error: e.message };
    return { ok: false, error: `Não consegui ler a planilha: ${(e as Error).message}` };
  }

  const chosenColumn =
    formData.get("column")?.toString() ||
    detectAutoMapping(parsed.headers).phoneColumn ||
    // Sem cabeçalho reconhecível, vale a primeira coluna que tenha cara de
    // telefone nas primeiras linhas.
    parsed.headers.find((h) =>
      parsed.rows.slice(0, 20).some((r) => (r[h] ?? "").replace(/\D/g, "").length >= 10),
    ) ||
    "";

  if (!chosenColumn) {
    return {
      ok: false,
      error: `Não achei a coluna de telefone. Cabeçalhos lidos: ${parsed.headers.join(", ")}`,
    };
  }

  const phones = parsed.rows
    .map((r) => (r[chosenColumn] ?? "").trim())
    .filter((v) => v.replace(/\D/g, "").length >= 8);

  if (phones.length === 0) {
    return { ok: false, error: `A coluna "${chosenColumn}" não tem telefone nenhum` };
  }

  return {
    ok: true,
    data: { phones, column: chosenColumn, total: parsed.rows.length },
  };
}
