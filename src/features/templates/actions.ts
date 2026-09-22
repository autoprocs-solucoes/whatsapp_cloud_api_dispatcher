"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  GraphApiError,
  createTemplate,
  deleteTemplate,
  extractPlaceholders,
  getTemplateAnalytics,
  uploadTemplateHeaderHandle,
  type CreateTemplateComponent,
  type MetaTemplateButton,
  type NamedParamExample,
  type TemplateAnalyticsPoint,
} from "@/lib/meta/graph-api";
import { createTemplateSchema } from "@/features/templates/schemas";
import { requireUser } from "@/server/auth";
import { syncTemplatesForWorkspace, syncTemplatesIfStale } from "@/server/templates";
import { getMetaConnections, type MetaConnectionView } from "@/server/meta";
import { requireActiveWorkspace, type WorkspaceWithRole } from "@/server/workspace";
import type { Template } from "@/lib/supabase/database.types";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };


/**
 * Quem pode mexer em modelo: owner do workspace ou time master (mesma regra
 * que libera Configurações). Devolve o workspace ativo junto pra não precisar
 * buscar de novo.
 */
async function requireTemplateManager(): Promise<
  { ok: true; workspace: WorkspaceWithRole } | { ok: false; error: string }
> {
  const user = await requireUser();
  const workspace = await requireActiveWorkspace();
  if (workspace.role !== "owner" && !user.profile.is_superadmin) {
    return { ok: false, error: "Apenas o owner pode gerenciar modelos." };
  }
  return { ok: true, workspace };
}

export async function listTemplatesForWorkspace(): Promise<Template[]> {
  const workspace = await requireActiveWorkspace();

  // Template criado no WhatsApp Manager (ou aprovado pela Meta depois) só
  // aparece aqui depois de um sync. Fazer isso na leitura, quando o espelho
  // está velho, evita a lista desatualizada sem ninguém perceber.
  await syncTemplatesIfStale(workspace.id);

  const admin = createAdminClient();
  let query = admin
    .from("template")
    .select("*")
    .eq("workspace_id", workspace.id);
  // Members só veem templates ativos. Owner vê todos (pra poder reativar).
  if (workspace.role !== "owner") query = query.eq("active", true);
  const { data } = await query
    .order("status", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
}

/**
 * Analytics (sent/delivered/read/clicked) dos últimos 30 dias, direto da
 * Graph API — batelado por conexão (WABA), já que o endpoint aceita vários
 * template_ids numa chamada só. Chave do mapa é `meta_template_id`.
 */
export async function getTemplateAnalyticsForWorkspace(
  templates: Template[],
  connections: MetaConnectionView[],
): Promise<Map<string, TemplateAnalyticsPoint>> {
  const out = new Map<string, TemplateAnalyticsPoint>();
  if (templates.length === 0 || connections.length === 0) return out;

  const now = new Date();
  const endUnix = Math.floor(now.getTime() / 1000);
  const startUnix = endUnix - 30 * 24 * 60 * 60;

  const templatesByConnection = new Map<string, string[]>();
  for (const t of templates) {
    const list = templatesByConnection.get(t.connection_id) ?? [];
    list.push(t.meta_template_id);
    templatesByConnection.set(t.connection_id, list);
  }

  await Promise.all(
    connections.map(async ({ connection }) => {
      const metaIds = templatesByConnection.get(connection.id);
      if (!metaIds || metaIds.length === 0) return;
      const result = await getTemplateAnalytics(
        connection.waba_id,
        connection.access_token,
        metaIds,
        startUnix,
        endUnix,
      );
      for (const [id, point] of result) out.set(id, point);
    }),
  );

  return out;
}

export async function setTemplateActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  if (workspace.role !== "owner") {
    return { ok: false, error: "Apenas o owner pode ativar/desativar templates." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("template")
    .update({ active })
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/templates");
  return { ok: true, data: undefined };
}

export async function syncTemplatesAction(): Promise<ActionResult<{ synced: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const workspace = await requireActiveWorkspace();
  const result = await syncTemplatesForWorkspace(workspace.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/templates");
  return { ok: true, data: { synced: result.synced } };
}

// ----------------------------------------------------------------------------
// Criação de modelo de mensagem.
// A Meta revisa (normalmente até 24h), então o modelo entra como PENDING e o
// status real chega no próximo sync.
// ----------------------------------------------------------------------------

function namedExamples(
  placeholders: string[],
  examples: Record<string, string>,
  prefix: "header" | "body",
): NamedParamExample[] {
  return placeholders.map((p) => ({
    param_name: p,
    example: examples[`${prefix}:${p}`] ?? "",
  }));
}

function positionalExamples(
  placeholders: string[],
  examples: Record<string, string>,
  prefix: "header" | "body",
): string[] {
  return placeholders.map((p) => examples[`${prefix}:${p}`] ?? "");
}

/**
 * Sobe o arquivo do cabeçalho de mídia e devolve o handle que a criação do
 * modelo exige. Fica separado da criação porque o upload acontece enquanto a
 * pessoa ainda está montando o modelo.
 */
export async function uploadTemplateHeaderAction(
  formData: FormData,
): Promise<ActionResult<{ handle: string }>> {
  const manager = await requireTemplateManager();
  if (!manager.ok) return { ok: false, error: manager.error };
  const { workspace } = manager;

  const connectionId = String(formData.get("connectionId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo" };
  }

  const connections = await getMetaConnections(workspace.id);
  const match = connections.find((c) => c.connection.id === connectionId);
  if (!match) return { ok: false, error: "Conexão Meta não encontrada" };

  try {
    const handle = await uploadTemplateHeaderHandle({
      token: match.connection.access_token,
      file,
    });
    return { ok: true, data: { handle } };
  } catch (e) {
    if (e instanceof GraphApiError) {
      console.error("[template] upload do cabeçalho recusado", JSON.stringify(e.payload));
      return { ok: false, error: `Meta: ${e.message}` };
    }
    return { ok: false, error: "Falha ao subir o arquivo do cabeçalho" };
  }
}

export async function createTemplateAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  const manager = await requireTemplateManager();
  if (!manager.ok) return { ok: false, error: manager.error };
  const { workspace } = manager;

  const parsed = createTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const data = parsed.data;

  const connections = await getMetaConnections(workspace.id);
  const match = connections.find((c) => c.connection.id === data.connectionId);
  if (!match) return { ok: false, error: "Conexão Meta não encontrada" };
  const { connection } = match;

  const headerPlaceholders =
    data.headerType === "TEXT" ? extractPlaceholders(data.headerText) : [];
  const bodyPlaceholders = extractPlaceholders(data.bodyText);
  const allPlaceholders = [...headerPlaceholders, ...bodyPlaceholders];

  // A Meta exige um modo só por modelo: ou tudo {{1}}, ou tudo {{nome}}.
  const isNumeric = (p: string) => /^[0-9]+$/.test(p);
  const named = allPlaceholders.some((p) => !isNumeric(p));
  if (named && allPlaceholders.some(isNumeric)) {
    return {
      ok: false,
      error: "Não misture: use só variáveis nomeadas ou só numeradas.",
    };
  }

  const missing = allPlaceholders.filter((p) => {
    const prefix = headerPlaceholders.includes(p) ? "header" : "body";
    return !(data.examples[`${prefix}:${p}`] ?? "").trim();
  });
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Dê um exemplo para cada variável: ${missing.map((p) => `{{${p}}}`).join(", ")}`,
    };
  }

  const components: CreateTemplateComponent[] = [];

  if (data.headerType === "TEXT") {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: data.headerText,
      ...(headerPlaceholders.length > 0
        ? {
            example: named
              ? {
                  header_text_named_params: namedExamples(
                    headerPlaceholders,
                    data.examples,
                    "header",
                  ),
                }
              : {
                  header_text: positionalExamples(headerPlaceholders, data.examples, "header"),
                },
          }
        : {}),
    });
  } else if (data.headerType !== "NONE") {
    components.push({
      type: "HEADER",
      format: data.headerType,
      example: { header_handle: [data.headerHandle] },
    });
  }

  components.push({
    type: "BODY",
    text: data.bodyText,
    ...(bodyPlaceholders.length > 0
      ? {
          example: named
            ? { body_text_named_params: namedExamples(bodyPlaceholders, data.examples, "body") }
            : { body_text: [positionalExamples(bodyPlaceholders, data.examples, "body")] },
        }
      : {}),
  });

  if (data.footerText) components.push({ type: "FOOTER", text: data.footerText });

  if (data.buttons.length > 0) {
    // A Meta tem um formato por tipo: link com variável leva `example`, e o
    // botão de copiar código leva o código como exemplo.
    const buttons: MetaTemplateButton[] = data.buttons.map((b) => {
      if (b.type === "URL") {
        return {
          type: "URL",
          text: b.text,
          url: b.url,
          ...(b.url.includes("{{") ? { example: [b.urlExample] } : {}),
        };
      }
      if (b.type === "PHONE_NUMBER") {
        return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number };
      }
      if (b.type === "COPY_CODE") {
        // Sem `text` e com `example` em texto puro: qualquer um dos dois fora
        // do formato faz a Meta devolver "Invalid parameter".
        return { type: "COPY_CODE", example: b.example };
      }
      return { type: "QUICK_REPLY", text: b.text };
    });
    components.push({ type: "BUTTONS", buttons });
  }

  let created;
  try {
    created = await createTemplate(connection.waba_id, connection.access_token, {
      name: data.name,
      language: data.language,
      category: data.category,
      ...(named ? { parameter_format: "NAMED" as const } : {}),
      components,
    });
  } catch (e) {
    if (e instanceof GraphApiError) {
      // O payload inteiro no log: a mensagem que vai pro toast é resumida, e
      // quando ela não basta é aqui que dá pra ver o que a Meta reclamou.
      console.error("[template] criação recusada pela Meta", JSON.stringify(e.payload));
      return { ok: false, error: `Meta: ${e.message}` };
    }
    return { ok: false, error: "Falha ao criar o modelo na Meta" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("template").upsert(
    {
      workspace_id: workspace.id,
      connection_id: connection.id,
      meta_template_id: created.id,
      name: data.name,
      language: data.language,
      category: created.category ?? data.category,
      status: created.status ?? "PENDING",
      header_text: data.headerType === "TEXT" ? data.headerText : null,
      body_text: data.bodyText,
      footer_text: data.footerText || null,
      buttons: data.buttons as never,
      components_raw: components as never,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,meta_template_id" },
  );
  if (error) {
    // O modelo existe na Meta; só o espelho local falhou — o sync resolve.
    return {
      ok: false,
      error: `Modelo criado na Meta, mas falhou ao salvar aqui: ${error.message}`,
    };
  }

  revalidatePath("/templates");
  return { ok: true, data: { status: created.status ?? "PENDING" } };
}

/** Apaga o modelo na Meta e o espelho local. */
export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  const manager = await requireTemplateManager();
  if (!manager.ok) return { ok: false, error: manager.error };
  const { workspace } = manager;

  const admin = createAdminClient();
  const { data: template } = await admin
    .from("template")
    .select("id, name, meta_template_id, connection_id")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!template) return { ok: false, error: "Modelo não encontrado" };

  const connections = await getMetaConnections(workspace.id);
  const match = connections.find((c) => c.connection.id === template.connection_id);
  if (!match) return { ok: false, error: "Conexão Meta não encontrada" };

  try {
    await deleteTemplate(
      match.connection.waba_id,
      match.connection.access_token,
      template.name,
      template.meta_template_id,
    );
  } catch (e) {
    if (e instanceof GraphApiError) return { ok: false, error: `Meta: ${e.message}` };
    return { ok: false, error: "Falha ao apagar o modelo na Meta" };
  }

  await admin.from("template").delete().eq("id", template.id);

  revalidatePath("/templates");
  return { ok: true, data: undefined };
}
