"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/server/workspace";
import {
  createSegmentSchema,
  deleteSegmentSchema,
  rulesSchema,
  updateSegmentSchema,
  type Rules,
} from "@/features/segments/schemas";
import { applyRules } from "@/features/segments/rules";
import type { Segment } from "@/lib/supabase/database.types";

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

function parseRulesField(raw: FormDataEntryValue | null): Rules | null {
  if (typeof raw !== "string") return null;
  try {
    const json = JSON.parse(raw);
    return rulesSchema.parse(json);
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Listagem / get
// ----------------------------------------------------------------------------
export async function listSegments(): Promise<Segment[]> {
  const ctx = await ensureMember();
  if (!ctx) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("segment")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getSegment(id: string): Promise<Segment | null> {
  const ctx = await ensureMember();
  if (!ctx) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("segment")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

// ----------------------------------------------------------------------------
// Chaves de custom_fields existentes no workspace — popula combobox do builder
// ----------------------------------------------------------------------------
export async function listCustomFieldKeys(): Promise<string[]> {
  const ctx = await ensureMember();
  if (!ctx) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("contact")
    .select("custom_fields")
    .eq("workspace_id", ctx.workspaceId)
    .limit(2000);

  const keys = new Set<string>();
  (data ?? []).forEach((row) => {
    const cf = row.custom_fields as Record<string, unknown> | null;
    if (cf && typeof cf === "object") {
      Object.keys(cf).forEach((k) => keys.add(k));
    }
  });
  return Array.from(keys).sort();
}

// ----------------------------------------------------------------------------
// Preview de contagem
// ----------------------------------------------------------------------------
export async function previewCountAction(rulesJson: string): Promise<ActionResult<{ count: number }>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  let rules: Rules;
  try {
    rules = rulesSchema.parse(JSON.parse(rulesJson));
  } catch {
    return { ok: false, error: "Regras inválidas" };
  }

  const admin = createAdminClient();
  const base = admin
    .from("contact")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspaceId);

  const query = applyRules(base, rules);
  const { count, error } = await query;
  if (error) return { ok: false, error: `Falha na consulta: ${error.message}` };
  return { ok: true, data: { count: count ?? 0 } };
}

// ----------------------------------------------------------------------------
// Create / Update / Delete
// ----------------------------------------------------------------------------
export async function createSegmentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const rules = parseRulesField(formData.get("rules"));
  if (!rules) return { ok: false, error: "Regras inválidas" };

  const parsed = createSegmentSchema.safeParse({
    name: formData.get("name"),
    rules,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("segment")
    .insert({
      workspace_id: ctx.workspaceId,
      name: parsed.data.name,
      rules: parsed.data.rules as never,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe um segmento com esse nome" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/segmentos");
  return { ok: true, data: { id: data.id } };
}

export async function updateSegmentAction(formData: FormData): Promise<ActionResult> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const rules = parseRulesField(formData.get("rules"));
  if (!rules) return { ok: false, error: "Regras inválidas" };

  const parsed = updateSegmentSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    rules,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("segment")
    .update({
      name: parsed.data.name,
      rules: parsed.data.rules as never,
    })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe um segmento com esse nome" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/segmentos");
  revalidatePath(`/segmentos/${parsed.data.id}`);
  return { ok: true, data: undefined };
}

export async function deleteSegmentAction(formData: FormData): Promise<ActionResult> {
  const ctx = await ensureMember();
  if (!ctx) return { ok: false, error: "Não autenticado" };

  const parsed = deleteSegmentSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("segment")
    .delete()
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/segmentos");
  return { ok: true, data: undefined };
}
