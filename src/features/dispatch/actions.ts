"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/server/workspace";
import { getMetaConnection } from "@/server/meta";
import {
  GraphApiError,
  extractPlaceholders,
  sendTemplate,
} from "@/lib/meta/graph-api";
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
  counts: Record<string, number>;
};

export async function listDispatches(): Promise<DispatchListItem[]> {
  const ctx = await ensureMember();
  if (!ctx) return [];

  const admin = createAdminClient();
  const { data: dispatches } = await admin
    .from("dispatch")
    .select("*, template:template_id(name)")
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
    const tpl = d.template as { name: string } | null;
    return {
      ...d,
      template: undefined,
      template_name: tpl?.name ?? null,
      counts: byDispatch[d.id] ?? {},
    } as DispatchListItem;
  });
}

export type DispatchDetail = {
  dispatch: Dispatch;
  template: Template | null;
  recipients: DispatchRecipient[];
  totalRecipients: number;
  counts: Record<string, number>;
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

  const { data: allStatuses } = await admin
    .from("dispatch_recipient")
    .select("status")
    .eq("dispatch_id", id);

  const counts: Record<string, number> = {};
  (allStatuses ?? []).forEach((r) => {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  });

  return {
    dispatch,
    template,
    recipients: recipients ?? [],
    totalRecipients: count ?? 0,
    counts,
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

  const conn = await getMetaConnection(ctx.workspaceId);
  if (!conn) return { ok: false, error: "Workspace sem conexão Meta" };

  const headerPlaceholders = extractPlaceholders(template.header_text);
  const bodyPlaceholders = extractPlaceholders(template.body_text);

  const syntheticRecipient: ResolvedRecipient = {
    contact_id: null,
    phone_e164: norm.e164,
    full_name: null,
    custom_fields: {},
  };
  const resolved = resolveVariables(syntheticRecipient, parsed.data.variable_mapping);
  const headerVars = headerPlaceholders.map((p) => resolved[`header:${p}`] ?? "");
  const bodyVars = bodyPlaceholders.map((p) => resolved[`body:${p}`] ?? "");

  try {
    const r = await sendTemplate({
      phoneNumberId: parsed.data.phone_number_id,
      to: norm.e164,
      token: conn.connection.access_token,
      templateName: template.name,
      language: template.language,
      headerVariables: headerVars,
      bodyVariables: bodyVars,
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
    return { ok: false, error: insertErr?.message ?? "Falha criando comunicado" };
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

  revalidatePath("/comunicados");
  return { ok: true, data: { id: dispatch.id, stats } };
}

// ----------------------------------------------------------------------------
// Execute dispatch (loop sequencial)
// ----------------------------------------------------------------------------
const RATE_LIMIT_DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function executeDispatchAction(
  formData: FormData,
): Promise<ActionResult<{ sent: number; failed: number }>> {
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
  if (!dispatch) return { ok: false, error: "Comunicado não encontrado" };
  if (dispatch.status !== "draft") {
    return { ok: false, error: `Comunicado já está ${dispatch.status}` };
  }

  const template = await loadTemplate(ctx.workspaceId, dispatch.template_id);
  if (!template) return { ok: false, error: "Template do comunicado não existe mais" };

  const conn = await getMetaConnection(ctx.workspaceId);
  if (!conn) return { ok: false, error: "Workspace sem conexão Meta" };

  // Marca como running
  const { error: lockErr } = await admin
    .from("dispatch")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", dispatch.id)
    .eq("status", "draft");
  if (lockErr) return { ok: false, error: `Falha ao marcar como running: ${lockErr.message}` };

  const { data: recipients } = await admin
    .from("dispatch_recipient")
    .select("*")
    .eq("dispatch_id", dispatch.id)
    .eq("status", "queued");

  const queue = recipients ?? [];
  const headerPlaceholders = extractPlaceholders(template.header_text);
  const bodyPlaceholders = extractPlaceholders(template.body_text);

  let sent = 0;
  let failed = 0;

  for (const r of queue) {
    const payload = (r.payload ?? {}) as Record<string, string>;
    const headerVars = headerPlaceholders.map((p) => payload[`header:${p}`] ?? "");
    const bodyVars = bodyPlaceholders.map((p) => payload[`body:${p}`] ?? "");

    try {
      const res = await sendTemplate({
        phoneNumberId: dispatch.phone_number_id,
        to: r.phone_e164,
        token: conn.connection.access_token,
        templateName: template.name,
        language: template.language,
        headerVariables: headerVars,
        bodyVariables: bodyVars,
      });
      await admin
        .from("dispatch_recipient")
        .update({
          status: "sent",
          meta_message_id: res.messageId,
          sent_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      sent++;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro desconhecido";
      const code = e instanceof GraphApiError ? String(e.status) : "exception";
      await admin
        .from("dispatch_recipient")
        .update({
          status: "failed",
          error_code: code,
          error_message: message.slice(0, 500),
          failed_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      failed++;
    }

    if (RATE_LIMIT_DELAY_MS > 0) await sleep(RATE_LIMIT_DELAY_MS);
  }

  const finalStatus: Dispatch["status"] =
    failed > 0 && sent === 0 ? "failed" : "done";

  await admin
    .from("dispatch")
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
    })
    .eq("id", dispatch.id);

  revalidatePath("/comunicados");
  revalidatePath(`/comunicados/${dispatch.id}`);
  return { ok: true, data: { sent, failed } };
}

