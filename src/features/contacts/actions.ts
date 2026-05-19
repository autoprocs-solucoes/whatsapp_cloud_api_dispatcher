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
// Confirma import: parse + normaliza + upsert em batch
// ----------------------------------------------------------------------------
export type ImportStats = {
  total: number;
  valid_new: number;
  valid_updated: number;
  invalid: number;
  duplicates_in_file: number;
  invalid_rows: { row: number; phone: string; reason: string }[];
};

const BATCH_SIZE = 500;

export async function confirmImportAction(
  formData: FormData,
): Promise<ActionResult<ImportStats>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

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

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = await parseSpreadsheet(buffer, file.name, file.type);
  } catch (e) {
    if (e instanceof SpreadsheetParseError) return { ok: false, error: e.message };
    return { ok: false, error: "Falha ao ler arquivo" };
  }

  const admin = createAdminClient();

  // Pega contatos existentes do workspace pra calcular new vs updated
  const { data: existing } = await admin
    .from("contact")
    .select("phone_e164")
    .eq("workspace_id", ctx.workspaceId);
  const existingSet = new Set((existing ?? []).map((c) => c.phone_e164));

  const seenInFile = new Set<string>();
  const stats: ImportStats = {
    total: parsed.rows.length,
    valid_new: 0,
    valid_updated: 0,
    invalid: 0,
    duplicates_in_file: 0,
    invalid_rows: [],
  };

  type Row = {
    workspace_id: string;
    phone_e164: string;
    full_name: string | null;
    custom_fields: Record<string, string>;
    created_by: string;
  };
  const upserts: Row[] = [];

  parsed.rows.forEach((row, i) => {
    const rawPhone = row[mapping.phoneColumn] ?? "";
    const norm = normalizeBR(rawPhone);
    if (!norm.ok) {
      stats.invalid++;
      stats.invalid_rows.push({ row: i + 2, phone: rawPhone, reason: norm.reason });
      return;
    }

    if (seenInFile.has(norm.e164)) {
      stats.duplicates_in_file++;
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

    if (existingSet.has(norm.e164)) {
      stats.valid_updated++;
    } else {
      stats.valid_new++;
    }

    upserts.push({
      workspace_id: ctx.workspaceId,
      phone_e164: norm.e164,
      full_name: fullName,
      custom_fields: customFields,
      created_by: ctx.userId,
    });
  });

  // Upsert em batches
  for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
    const batch = upserts.slice(i, i + BATCH_SIZE);
    const { error } = await admin
      .from("contact")
      .upsert(batch, { onConflict: "workspace_id,phone_e164", ignoreDuplicates: false });
    if (error) {
      return { ok: false, error: `Erro inserindo lote ${i / BATCH_SIZE + 1}: ${error.message}` };
    }
  }

  // Audit em contact_import
  await admin.from("contact_import").insert({
    workspace_id: ctx.workspaceId,
    filename: file.name,
    mapping: JSON.parse(JSON.stringify(mapping)),
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
