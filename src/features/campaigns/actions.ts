"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/server/auth";
import { requireActiveWorkspace } from "@/server/workspace";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const campaignSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à campanha").max(80),
  description: z.string().trim().max(280).default(""),
  /** Template de abertura — sem ele a campanha existe, mas não transmite. */
  templateId: z.string().uuid().nullable().default(null),
  /** Fluxo que continua a conversa depois da resposta. Opcional. */
  flowId: z.string().uuid().nullable().default(null),
});

export async function createCampaignAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const workspace = await requireActiveWorkspace();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaign")
    .insert({
      workspace_id: workspace.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      template_id: parsed.data.templateId,
      flow_id: parsed.data.flowId,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao criar a campanha" };

  revalidatePath("/campanhas");
  return { ok: true, data: { id: data.id } };
}

const updateSchema = campaignSchema.extend({ id: z.string().uuid() });

export async function updateCampaignAction(input: unknown): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("campaign")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      template_id: parsed.data.templateId,
      flow_id: parsed.data.flowId,
    })
    .eq("id", parsed.data.id)
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/campanhas");
  return { ok: true, data: undefined };
}

/**
 * Arquivar em vez de apagar quando a campanha já transmitiu: o histórico das
 * transmissões aponta pra ela, e perder o nome deixaria o relatório órfão.
 */
export async function setCampaignStatusAction(
  id: string,
  status: "active" | "archived",
): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();
  const { error } = await admin
    .from("campaign")
    .update({ status })
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/campanhas");
  return { ok: true, data: undefined };
}

export async function deleteCampaignAction(id: string): Promise<ActionResult> {
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();

  const { count } = await admin
    .from("dispatch")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "Essa campanha já transmitiu. Arquive em vez de apagar pra não perder o histórico.",
    };
  }

  const { error } = await admin
    .from("campaign")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/campanhas");
  return { ok: true, data: undefined };
}
