import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  GraphApiError,
  listTemplates,
  type MetaTemplate,
  type MetaTemplateComponent,
} from "@/lib/meta/graph-api";
import { getMetaConnections } from "@/server/meta";

/**
 * Espelho local dos templates da Meta.
 *
 * O conteúdo de verdade vive lá: a pessoa cria pelo app ou pelo WhatsApp
 * Manager, e a Meta muda o status sozinha quando aprova ou rejeita. Aqui fica
 * a cópia que as telas leem sem depender da Graph API a cada render.
 */

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

export type SyncResult = { ok: true; synced: number } | { ok: false; error: string };

/**
 * Puxa os templates de todas as WABAs do workspace e atualiza o espelho.
 *
 * Sem `revalidatePath` de propósito: isso aqui também roda durante o render
 * das páginas (auto-sync), e revalidar dentro de um render é proibido no Next.
 * Quem chama por ação do usuário revalida depois.
 */
export async function syncTemplatesForWorkspace(workspaceId: string): Promise<SyncResult> {
  const connections = await getMetaConnections(workspaceId);
  if (connections.length === 0) {
    return { ok: false, error: "Workspace sem conexão Meta. Conecte em Configurações." };
  }

  const admin = createAdminClient();
  let totalSynced = 0;

  // Uma WABA por vez: template pertence a uma conta específica, não ao
  // workspace como um todo.
  for (const { connection } of connections) {
    let templates: MetaTemplate[];
    try {
      templates = await listTemplates(connection.waba_id, connection.access_token);
    } catch (e) {
      const who = connection.business_name ?? connection.waba_id;
      if (e instanceof GraphApiError) return { ok: false, error: `Meta (${who}): ${e.message}` };
      return { ok: false, error: `Falha ao buscar templates da Meta (${who})` };
    }

    const rows = templates.map((t) => {
      const texts = extractTexts(t.components);
      return {
        workspace_id: workspaceId,
        connection_id: connection.id,
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
      totalSynced += rows.length;
    }
  }

  return { ok: true, synced: totalSynced };
}

/** Quanto tempo o espelho vale antes de valer a pena consultar a Meta de novo. */
const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Sincroniza só se o espelho estiver velho.
 *
 * É o que faz um template criado no WhatsApp Manager aparecer sem ninguém
 * lembrar de apertar Sincronizar. Falha em silêncio: se a Meta estiver fora do
 * ar, a tela abre com o que já tem em vez de quebrar.
 */
export async function syncTemplatesIfStale(workspaceId: string): Promise<void> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("template")
    .select("last_synced_at")
    .eq("workspace_id", workspaceId)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSync = data?.last_synced_at ? new Date(data.last_synced_at).getTime() : 0;
  if (Date.now() - lastSync < STALE_AFTER_MS) return;

  try {
    await syncTemplatesForWorkspace(workspaceId);
  } catch {
    // Espelho velho é melhor que tela quebrada.
  }
}
