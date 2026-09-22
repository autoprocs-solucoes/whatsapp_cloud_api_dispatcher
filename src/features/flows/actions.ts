"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  EMPTY_GRAPH,
  createFlowSchema,
  createFolderSchema,
  moveFlowSchema,
  openingTemplateNode,
  parseGraph,
  renameSchema,
  saveFlowGraphSchema,
} from "@/features/flows/schemas";
import { FLOW_PRESETS, isPresetKey, presetGraph } from "@/features/flows/presets";
import { requireUser } from "@/server/auth";
import { requireActiveWorkspace } from "@/server/workspace";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ----------------------------------------------------------------------------
// Pastas
// ----------------------------------------------------------------------------

export async function createFolderAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const workspace = await requireActiveWorkspace();
  const parsed = createFolderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("flow_folder")
    .insert({ workspace_id: workspace.id, name: parsed.data.name })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao criar a pasta" };

  revalidatePath("/fluxos");
  return { ok: true, data: { id: data.id } };
}

export async function renameFolderAction(input: unknown): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("flow_folder")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/fluxos");
  return { ok: true, data: undefined };
}

/** Apaga a pasta. Os fluxos dentro dela ficam soltos (o banco põe folder_id
 * como null) — apagar fluxo é sempre ação explícita. */
export async function deleteFolderAction(id: string): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();
  const { error } = await admin
    .from("flow_folder")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/fluxos");
  return { ok: true, data: undefined };
}

// ----------------------------------------------------------------------------
// Fluxos
// ----------------------------------------------------------------------------

export async function createFlowAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const workspace = await requireActiveWorkspace();
  const parsed = createFlowSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("flow")
    .insert({
      workspace_id: workspace.id,
      folder_id: parsed.data.folderId,
      name: parsed.data.name,
      graph: EMPTY_GRAPH as never,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao criar o fluxo" };

  revalidatePath("/fluxos");
  return { ok: true, data: { id: data.id } };
}

export async function renameFlowAction(input: unknown): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("flow")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/fluxos");
  return { ok: true, data: undefined };
}

export async function moveFlowAction(input: unknown): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  const parsed = moveFlowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("flow")
    .update({ folder_id: parsed.data.folderId })
    .eq("id", parsed.data.flowId)
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/fluxos");
  return { ok: true, data: undefined };
}

export async function deleteFlowAction(id: string): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();
  const { error } = await admin
    .from("flow")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/fluxos");
  return { ok: true, data: undefined };
}

/** Cópia do fluxo com o mesmo desenho, sempre como rascunho. */
export async function duplicateFlowAction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();

  const { data: original } = await admin
    .from("flow")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!original) return { ok: false, error: "Fluxo não encontrado" };

  const { data, error } = await admin
    .from("flow")
    .insert({
      workspace_id: workspace.id,
      folder_id: original.folder_id,
      name: `${original.name} (cópia)`,
      description: original.description,
      graph: original.graph,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao duplicar" };

  revalidatePath("/fluxos");
  return { ok: true, data: { id: data.id } };
}

/**
 * Salva o desenho. Publicar é separado: enquanto o fluxo está publicado e em
 * uso por uma transmissão, editar o canvas não deve mudar o que já está
 * rodando sem a pessoa dizer que quer isso.
 */
export async function saveFlowGraphAction(input: unknown): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  const parsed = saveFlowGraphSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Desenho inválido" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("flow")
    .update({ graph: parsed.data.graph as never })
    .eq("id", parsed.data.flowId)
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/fluxos");
  return { ok: true, data: undefined };
}

export async function publishFlowAction(id: string): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();

  const { data: flow } = await admin
    .from("flow")
    .select("graph")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!flow) return { ok: false, error: "Fluxo não encontrado" };

  const graph = parseGraph(flow.graph);

  // Sem modelo de abertura não há transmissão: é ele que sai fora da janela.
  const opening = openingTemplateNode(graph);
  if (!opening || opening.data.kind !== "template" || !opening.data.templateId) {
    return { ok: false, error: "Escolha o modelo de abertura antes de publicar" };
  }

  const { data: template } = await admin
    .from("template")
    .select("status, active")
    .eq("id", opening.data.templateId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!template) return { ok: false, error: "O modelo de abertura não existe mais" };
  if (template.status !== "APPROVED") {
    return { ok: false, error: `O modelo de abertura está ${template.status}, não aprovado` };
  }
  if (!template.active) {
    return { ok: false, error: "O modelo de abertura está desativado" };
  }

  const messages = graph.nodes.filter((n) => n.type === "message");
  const empty = messages.find((n) => n.data.kind === "message" && !n.data.body.trim());
  if (empty) return { ok: false, error: "Tem mensagem sem texto no fluxo" };

  for (const node of messages) {
    if (node.data.kind !== "message") continue;
    const links = node.data.buttons.filter((b) => b.kind === "url");
    if (links.length > 1) {
      return { ok: false, error: "Cada mensagem só pode ter um botão de link" };
    }
    if (links.length === 1 && node.data.buttons.length > 1) {
      return {
        ok: false,
        error: "Mensagem com botão de link não pode ter outros botões — a Meta entrega o link sozinho",
      };
    }
    const semUrl = links.find((b) => !b.url.trim());
    if (semUrl) return { ok: false, error: `O botão "${semUrl.label}" está sem endereço` };

    const semTelefone = node.data.buttons.find((b) => b.kind === "phone" && !b.phone.trim());
    if (semTelefone) {
      return { ok: false, error: `O botão "${semTelefone.label}" está sem telefone` };
    }

    const semCodigo = node.data.buttons.find((b) => b.kind === "copy_code" && !b.code.trim());
    if (semCodigo) {
      return { ok: false, error: `O botão "${semCodigo.label}" está sem código` };
    }
  }

  const { error } = await admin
    .from("flow")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/fluxos");
  return { ok: true, data: undefined };
}

export async function unpublishFlowAction(id: string): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();
  const { error } = await admin
    .from("flow")
    .update({ status: "draft" })
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/fluxos");
  return { ok: true, data: undefined };
}

/** Cria um fluxo já desenhado a partir de um dos padrões básicos. */
export async function createFlowFromPresetAction(
  presetKey: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const workspace = await requireActiveWorkspace();
  if (!isPresetKey(presetKey)) return { ok: false, error: "Padrão desconhecido" };

  const preset = FLOW_PRESETS.find((p) => p.key === presetKey)!;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("flow")
    .insert({
      workspace_id: workspace.id,
      name: preset.label,
      graph: presetGraph(presetKey) as never,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao criar o fluxo" };

  revalidatePath("/fluxos");
  return { ok: true, data: { id: data.id } };
}

// ----------------------------------------------------------------------------
// Mídia dos blocos
// ----------------------------------------------------------------------------

const MEDIA_LIMITS: Record<string, { mimes: string[]; maxBytes: number; label: string }> = {
  image: { mimes: ["image/png", "image/jpeg", "image/webp"], maxBytes: 5 * 1024 * 1024, label: "imagem" },
  video: { mimes: ["video/mp4", "video/3gpp"], maxBytes: 16 * 1024 * 1024, label: "vídeo" },
  document: {
    mimes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    maxBytes: 100 * 1024 * 1024,
    label: "arquivo",
  },
};

/**
 * Sobe a mídia de um bloco e devolve a URL pública.
 *
 * Público de propósito: quem baixa o arquivo é o servidor da Meta na hora de
 * entregar a mensagem, e ele não manda credencial nenhuma. Os limites de
 * tamanho são os da Cloud API — passar deles faz a mensagem falhar só no
 * envio, longe daqui.
 */
export async function uploadFlowMediaAction(
  formData: FormData,
): Promise<ActionResult<{ url: string; filename: string }>> {
  const workspace = await requireActiveWorkspace();

  const kind = String(formData.get("kind") ?? "");
  const limits = MEDIA_LIMITS[kind];
  if (!limits) return { ok: false, error: "Tipo de mídia inválido" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo" };
  }
  if (!limits.mimes.includes(file.type)) {
    return { ok: false, error: `Formato não aceito pra ${limits.label}: ${file.type || "desconhecido"}` };
  }
  if (file.size > limits.maxBytes) {
    const mb = Math.round(limits.maxBytes / (1024 * 1024));
    return { ok: false, error: `Arquivo muito grande (máx. ${mb}MB pra ${limits.label})` };
  }

  const admin = createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${workspace.id}/${Date.now()}-${safeName}`;

  const { error } = await admin.storage.from("flow-media").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) return { ok: false, error: `Falha no upload: ${error.message}` };

  const {
    data: { publicUrl },
  } = admin.storage.from("flow-media").getPublicUrl(path);

  return { ok: true, data: { url: publicUrl, filename: file.name } };
}
