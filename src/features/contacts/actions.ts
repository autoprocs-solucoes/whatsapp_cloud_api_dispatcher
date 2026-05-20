"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeBR } from "@/lib/phone/e164";
import {
  detectAutoMapping,
  parseSpreadsheet,
  SpreadsheetParseError,
  type AutoMapping,
} from "@/lib/import/parse-spreadsheet";
import { requireActiveWorkspace } from "@/server/workspace";
import {
  createContactSchema,
  deleteContactSchema,
  listContactsSchema,
  mappingSchema,
  toggleOptOutSchema,
  updateContactSchema,
  type ImportMapping,
  type ListContactsParams,
} from "@/features/contacts/schemas";
import type { Contact } from "@/lib/supabase/database.types";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function ensureMember(): Promise<{ workspaceId: string; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const workspace = await requireActiveWorkspace();
  return { workspaceId: workspace.id, userId: user.id };
}

// ----------------------------------------------------------------------------
// Preview do import: lê arquivo, retorna headers + 10 linhas + auto-mapping
// ----------------------------------------------------------------------------
export type PreviewImportResult = {
  headers: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  autoMapping: AutoMapping;
};

export async function previewImportAction(
  formData: FormData,
): Promise<ActionResult<PreviewImportResult>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo .xlsx ou .csv" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseSpreadsheet(buffer, file.name, file.type);
    return {
      ok: true,
      data: {
        headers: parsed.headers,
        sampleRows: parsed.rows.slice(0, 10),
        totalRows: parsed.rows.length,
        autoMapping: detectAutoMapping(parsed.headers),
      },
    };
  } catch (e) {
    if (e instanceof SpreadsheetParseError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Falha ao ler arquivo" };
  }
}

// ----------------------------------------------------------------------------
// Análise e confirmação do import
// ----------------------------------------------------------------------------
export type ImportStats = {
  total: number;
  valid_new: number;
  valid_updated: number;
  invalid: number;
  duplicates_in_file: number;
  invalid_rows: { row: number; phone: string; reason: string }[];
};

export type PreviewRow = {
  row: number;
  phone_e164: string;
  full_name: string | null;
};

export type ImportAnalysis = ImportStats & {
  new_sample: PreviewRow[];
  updated_sample: PreviewRow[];
};

const PREVIEW_SAMPLE_LIMIT = 100;
const BATCH_SIZE = 500;

type UpsertRow = {
  workspace_id: string;
  phone_e164: string;
  full_name: string | null;
  custom_fields: Record<string, string>;
  created_by: string;
};

async function parseFileAndMapping(
  formData: FormData,
): Promise<
  | { ok: true; parsed: Awaited<ReturnType<typeof parseSpreadsheet>>; mapping: ImportMapping; file: File }
  | { ok: false; error: string }
> {
  const file = formData.get("file");
  const mappingRaw = formData.get("mapping");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Arquivo ausente" };
  }
  if (typeof mappingRaw !== "string") {
    return { ok: false, error: "Mapeamento ausente" };
  }

  let mapping: ImportMapping;
  try {
    const json = JSON.parse(mappingRaw);
    mapping = mappingSchema.parse(json);
  } catch {
    return { ok: false, error: "Mapeamento inválido" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseSpreadsheet(buffer, file.name, file.type);
    return { ok: true, parsed, mapping, file };
  } catch (e) {
    if (e instanceof SpreadsheetParseError) return { ok: false, error: e.message };
    return { ok: false, error: "Falha ao ler arquivo" };
  }
}

async function analyzeRows(
  parsed: Awaited<ReturnType<typeof parseSpreadsheet>>,
  mapping: ImportMapping,
  ctx: { workspaceId: string; userId: string },
): Promise<{ analysis: ImportAnalysis; upserts: UpsertRow[] }> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("contact")
    .select("phone_e164")
    .eq("workspace_id", ctx.workspaceId);
  const existingSet = new Set((existing ?? []).map((c) => c.phone_e164));

  const seenInFile = new Set<string>();
  const analysis: ImportAnalysis = {
    total: parsed.rows.length,
    valid_new: 0,
    valid_updated: 0,
    invalid: 0,
    duplicates_in_file: 0,
    invalid_rows: [],
    new_sample: [],
    updated_sample: [],
  };
  const upserts: UpsertRow[] = [];

  parsed.rows.forEach((row, i) => {
    const rawPhone = row[mapping.phoneColumn] ?? "";
    const norm = normalizeBR(rawPhone);
    if (!norm.ok) {
      analysis.invalid++;
      analysis.invalid_rows.push({ row: i + 2, phone: rawPhone, reason: norm.reason });
      return;
    }

    if (seenInFile.has(norm.e164)) {
      analysis.duplicates_in_file++;
      return;
    }
    seenInFile.add(norm.e164);

    const customFields: Record<string, string> = {};
    mapping.customColumns.forEach(({ sourceHeader, fieldKey }) => {
      const v = row[sourceHeader];
      if (v && v.trim()) customFields[fieldKey] = v.trim();
    });

    const nameRaw = mapping.fullNameColumn ? row[mapping.fullNameColumn] : undefined;
    const fullName = nameRaw ? nameRaw.trim() : null;
    const previewRow: PreviewRow = { row: i + 2, phone_e164: norm.e164, full_name: fullName };

    if (existingSet.has(norm.e164)) {
      analysis.valid_updated++;
      if (analysis.updated_sample.length < PREVIEW_SAMPLE_LIMIT) {
        analysis.updated_sample.push(previewRow);
      }
    } else {
      analysis.valid_new++;
      if (analysis.new_sample.length < PREVIEW_SAMPLE_LIMIT) {
        analysis.new_sample.push(previewRow);
      }
    }

    upserts.push({
      workspace_id: ctx.workspaceId,
      phone_e164: norm.e164,
      full_name: fullName,
      custom_fields: customFields,
      created_by: ctx.userId,
    });
  });

  return { analysis, upserts };
}

export async function analyzeImportAction(
  formData: FormData,
): Promise<ActionResult<ImportAnalysis>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const prep = await parseFileAndMapping(formData);
  if (!prep.ok) return { ok: false, error: prep.error };

  const { analysis } = await analyzeRows(prep.parsed, prep.mapping, ctx);
  return { ok: true, data: analysis };
}

export async function confirmImportAction(
  formData: FormData,
): Promise<ActionResult<ImportStats>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const prep = await parseFileAndMapping(formData);
  if (!prep.ok) return { ok: false, error: prep.error };

  const { analysis, upserts } = await analyzeRows(prep.parsed, prep.mapping, ctx);
  const admin = createAdminClient();

  for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
    const batch = upserts.slice(i, i + BATCH_SIZE);
    const { error } = await admin
      .from("contact")
      .upsert(batch, { onConflict: "workspace_id,phone_e164", ignoreDuplicates: false });
    if (error) {
      return { ok: false, error: `Erro inserindo lote ${i / BATCH_SIZE + 1}: ${error.message}` };
    }
  }

  const stats: ImportStats = {
    total: analysis.total,
    valid_new: analysis.valid_new,
    valid_updated: analysis.valid_updated,
    invalid: analysis.invalid,
    duplicates_in_file: analysis.duplicates_in_file,
    invalid_rows: analysis.invalid_rows,
  };

  await admin.from("contact_import").insert({
    workspace_id: ctx.workspaceId,
    filename: prep.file.name,
    mapping: JSON.parse(JSON.stringify(prep.mapping)),
    stats: JSON.parse(JSON.stringify({ ...stats, invalid_rows: stats.invalid_rows.length })),
    created_by: ctx.userId,
  });

  revalidatePath("/contatos");
  return { ok: true, data: stats };
}

// ----------------------------------------------------------------------------
// Listagem com busca, filtros, paginação
// ----------------------------------------------------------------------------
export type ListContactsResult = {
  contacts: Contact[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listContacts(
  params: Partial<ListContactsParams>,
): Promise<ListContactsResult> {
  const ctx = await ensureMember();
  if (!ctx) return { contacts: [], total: 0, page: 1, pageSize: 50 };

  const parsed = listContactsSchema.parse(params);
  const admin = createAdminClient();

  let query = admin
    .from("contact")
    .select("*", { count: "exact" })
    .eq("workspace_id", ctx.workspaceId);

  if (parsed.optOutFilter === "active") query = query.eq("opt_out", false);
  if (parsed.optOutFilter === "opt_out") query = query.eq("opt_out", true);

  if (parsed.search.trim()) {
    const s = parsed.search.trim().replace(/[%_]/g, "\\$&");
    query = query.or(`full_name.ilike.%${s}%,phone_e164.ilike.%${s}%`);
  }

  const from = (parsed.page - 1) * parsed.pageSize;
  const to = from + parsed.pageSize - 1;
  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count } = await query;
  return {
    contacts: data ?? [],
    total: count ?? 0,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}

// ----------------------------------------------------------------------------
// Update / Toggle opt-out / Delete
// ----------------------------------------------------------------------------
export async function updateContactAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const customFieldsRaw = formData.get("custom_fields");
  const tagsRaw = formData.get("tags");
  let customFields: Record<string, string> = {};
  let tags: string[] = [];
  try {
    customFields = customFieldsRaw ? JSON.parse(String(customFieldsRaw)) : {};
    tags = tagsRaw ? JSON.parse(String(tagsRaw)) : [];
  } catch {
    return { ok: false, error: "JSON inválido em custom_fields/tags" };
  }

  const parsed = updateContactSchema.safeParse({
    id: formData.get("id"),
    full_name: formData.get("full_name") || null,
    custom_fields: customFields,
    tags,
  });
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("contact")
    .update({
      full_name: parsed.data.full_name,
      custom_fields: parsed.data.custom_fields,
      tags: parsed.data.tags,
    })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/contatos");
  return { ok: true, data: undefined };
}

export async function toggleOptOutAction(formData: FormData): Promise<ActionResult> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const parsed = toggleOptOutSchema.safeParse({
    id: formData.get("id"),
    opt_out: formData.get("opt_out") === "true",
  });
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("contact")
    .update({
      opt_out: parsed.data.opt_out,
      opt_out_at: parsed.data.opt_out ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/contatos");
  return { ok: true, data: undefined };
}

export async function createContactAction(formData: FormData): Promise<ActionResult> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const customFieldsRaw = formData.get("custom_fields");
  const tagsRaw = formData.get("tags");
  let customFields: Record<string, string> = {};
  let tags: string[] = [];
  try {
    customFields = customFieldsRaw ? JSON.parse(String(customFieldsRaw)) : {};
    tags = tagsRaw ? JSON.parse(String(tagsRaw)) : [];
  } catch {
    return { ok: false, error: "JSON inválido em custom_fields/tags" };
  }

  const parsed = createContactSchema.safeParse({
    phone: formData.get("phone"),
    full_name: formData.get("full_name") || null,
    custom_fields: customFields,
    tags,
  });
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const norm = normalizeBR(parsed.data.phone);
  if (!norm.ok) return { ok: false, error: `Telefone inválido: ${norm.reason}` };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("contact")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("phone_e164", norm.e164)
    .maybeSingle();
  if (existing) return { ok: false, error: "Já existe contato com esse telefone" };

  const { error } = await admin.from("contact").insert({
    workspace_id: ctx.workspaceId,
    phone_e164: norm.e164,
    full_name: parsed.data.full_name,
    custom_fields: parsed.data.custom_fields,
    tags: parsed.data.tags,
    created_by: ctx.userId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/contatos");
  return { ok: true, data: undefined };
}

export async function deleteContactAction(formData: FormData): Promise<ActionResult> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const parsed = deleteContactSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("contact")
    .delete()
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/contatos");
  return { ok: true, data: undefined };
}
