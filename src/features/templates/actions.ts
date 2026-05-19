"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  GraphApiError,
  listTemplates,
  type MetaTemplate,
  type MetaTemplateComponent,
} from "@/lib/meta/graph-api";
import { getMetaConnection } from "@/server/meta";
import { requireActiveWorkspace } from "@/server/workspace";
import type { Template } from "@/lib/supabase/database.types";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function extractTexts(components: MetaTemplateComponent[]) {
  let header_text: string | null = null;
  let body_text: string | null = null;
  let footer_text: string | null = null;
  let buttons: unknown = [];

  for (const c of components) {
    if (c.type === "HEADER" && c.format === "TEXT") header_text = c.text ?? null;
    if (c.type === "BODY") body_text = c.text ?? null;
    if (c.type === "FOOTER") footer_text = c.text ?? null;
    if (c.type === "BUTTONS") buttons = c.buttons ?? [];
  }

  return { header_text, body_text, footer_text, buttons };
}

export async function listTemplatesForWorkspace(): Promise<Template[]> {
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();
  const { data } = await admin
    .from("template")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("status", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
}

export async function syncTemplatesAction(): Promise<ActionResult<{ synced: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const workspace = await requireActiveWorkspace();
  const conn = await getMetaConnection(workspace.id);
  if (!conn) {
    return { ok: false, error: "Workspace sem conexão Meta. Conecte em Configurações." };
  }

  let templates: MetaTemplate[];
  try {
    templates = await listTemplates(conn.connection.waba_id, conn.connection.access_token);
  } catch (e) {
    if (e instanceof GraphApiError) {
      return { ok: false, error: `Meta: ${e.message}` };
    }
    return { ok: false, error: "Falha ao buscar templates da Meta" };
  }

  const admin = createAdminClient();
  const rows = templates.map((t) => {
    const texts = extractTexts(t.components);
    return {
      workspace_id: workspace.id,
      meta_template_id: t.id,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      header_text: texts.header_text,
      body_text: texts.body_text,
      footer_text: texts.footer_text,
      buttons: texts.buttons as never,
      components_raw: t.components as never,
      last_synced_at: new Date().toISOString(),
    };
  });

  if (rows.length > 0) {
    const { error } = await admin
      .from("template")
      .upsert(rows, { onConflict: "workspace_id,meta_template_id", ignoreDuplicates: false });
    if (error) return { ok: false, error: `Erro salvando templates: ${error.message}` };
  }

  revalidatePath("/templates");
  return { ok: true, data: { synced: rows.length } };
}
