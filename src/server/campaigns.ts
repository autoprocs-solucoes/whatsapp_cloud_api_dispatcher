import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { statusCountsByDispatch, sumSent } from "@/server/dispatch-counts";
import { openingTemplateId, parseGraph } from "@/features/flows/schemas";
import { requireActiveWorkspace } from "@/server/workspace";

/**
 * Campanha é o grupo da informação: ela aponta para um fluxo, e o fluxo carrega
 * o modelo de abertura no primeiro bloco. Por isso o template aparece aqui
 * sempre derivado do desenho — nunca guardado de novo na campanha.
 */

export type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  flowId: string | null;
  flowName: string | null;
  flowStatus: "draft" | "published" | null;
  templateId: string | null;
  templateName: string | null;
  templateStatus: string | null;
  /** Quantas transmissões já saíram dessa campanha. */
  broadcastCount: number;
  /** Mensagens efetivamente entregues por todas as transmissões dela. */
  sentCount: number;
  /** Pronta pra transmitir: fluxo publicado e modelo de abertura aprovado. */
  sendable: boolean;
  createdAt: string;
};

type FlowShape = { name: string; graph: unknown; status: "draft" | "published" };

async function templatesByIds(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<Map<string, { name: string; status: string; active: boolean }>> {
  const out = new Map<string, { name: string; status: string; active: boolean }>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return out;

  const { data } = await admin
    .from("template")
    .select("id, name, status, active")
    .in("id", unique);
  for (const t of data ?? []) {
    out.set(t.id, { name: t.name, status: t.status, active: t.active });
  }
  return out;
}

export async function listCampaigns(): Promise<CampaignRow[]> {
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();

  const { data: campaigns } = await admin
    .from("campaign")
    .select("*, flow:flow_id(name, graph, status)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (!campaigns || campaigns.length === 0) return [];

  const openingByCampaign = new Map<string, string | null>();
  for (const c of campaigns) {
    const flow = (c as { flow?: FlowShape | null }).flow;
    openingByCampaign.set(c.id, flow ? openingTemplateId(parseGraph(flow.graph)) : null);
  }
  const templates = await templatesByIds(
    admin,
    [...openingByCampaign.values()].filter((id): id is string => id !== null),
  );

  const ids = campaigns.map((c) => c.id);
  const { data: dispatches } = await admin
    .from("dispatch")
    .select("id, campaign_id")
    .in("campaign_id", ids);

  const countByCampaign = new Map<string, number>();
  for (const d of dispatches ?? []) {
    if (!d.campaign_id) continue;
    countByCampaign.set(d.campaign_id, (countByCampaign.get(d.campaign_id) ?? 0) + 1);
  }

  const sentByCampaign = new Map<string, number>();
  const dispatchIds = (dispatches ?? []).map((d) => d.id);
  if (dispatchIds.length > 0) {
    const campaignByDispatch = new Map(
      (dispatches ?? []).map((d) => [d.id, d.campaign_id] as const),
    );
    const counts = await statusCountsByDispatch(dispatchIds);
    for (const [dispatchId, byStatus] of counts) {
      const campaignId = campaignByDispatch.get(dispatchId);
      if (!campaignId) continue;
      sentByCampaign.set(
        campaignId,
        (sentByCampaign.get(campaignId) ?? 0) + sumSent(byStatus),
      );
    }
  }

  return campaigns.map((c) => {
    const flow = (c as { flow?: FlowShape | null }).flow;
    const templateId = openingByCampaign.get(c.id) ?? null;
    const template = templateId ? templates.get(templateId) : undefined;
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      status: c.status,
      flowId: c.flow_id,
      flowName: flow?.name ?? null,
      flowStatus: flow?.status ?? null,
      templateId,
      templateName: template?.name ?? null,
      templateStatus: template?.status ?? null,
      broadcastCount: countByCampaign.get(c.id) ?? 0,
      sentCount: sentByCampaign.get(c.id) ?? 0,
      sendable:
        c.status === "active" &&
        flow?.status === "published" &&
        template?.status === "APPROVED" &&
        template?.active === true,
      createdAt: c.created_at,
    };
  });
}

export type SendableCampaign = {
  id: string;
  name: string;
  flowId: string;
  flowName: string;
  templateId: string;
  templateName: string;
};

/** Campanhas que a transmissão pode disparar hoje. */
export async function listSendableCampaigns(workspaceId: string): Promise<SendableCampaign[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("campaign")
    .select("id, name, flow_id, flow:flow_id(name, graph, status)")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("name", { ascending: true });
  if (!data || data.length === 0) return [];

  const openings = new Map<string, string | null>();
  for (const c of data) {
    const flow = (c as { flow?: FlowShape | null }).flow;
    openings.set(
      c.id,
      flow?.status === "published" ? openingTemplateId(parseGraph(flow.graph)) : null,
    );
  }
  const templates = await templatesByIds(
    admin,
    [...openings.values()].filter((id): id is string => id !== null),
  );

  const out: SendableCampaign[] = [];
  for (const c of data) {
    const flow = (c as { flow?: FlowShape | null }).flow;
    const templateId = openings.get(c.id);
    if (!c.flow_id || !flow || !templateId) continue;
    const template = templates.get(templateId);
    if (!template || template.status !== "APPROVED" || !template.active) continue;
    out.push({
      id: c.id,
      name: c.name,
      flowId: c.flow_id,
      flowName: flow.name,
      templateId,
      templateName: template.name,
    });
  }
  return out;
}
