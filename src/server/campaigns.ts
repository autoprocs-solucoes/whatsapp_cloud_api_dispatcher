import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveWorkspace } from "@/server/workspace";

export type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  templateId: string | null;
  templateName: string | null;
  templateStatus: string | null;
  flowId: string | null;
  flowName: string | null;
  /** Quantas transmissões já saíram dessa campanha. */
  broadcastCount: number;
  /** Mensagens efetivamente entregues por todas as transmissões dela. */
  sentCount: number;
  createdAt: string;
};

export async function listCampaigns(): Promise<CampaignRow[]> {
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();

  const { data: campaigns } = await admin
    .from("campaign")
    .select("*, template:template_id(name, status), flow:flow_id(name)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (!campaigns || campaigns.length === 0) return [];

  const ids = campaigns.map((c) => c.id);
  const { data: dispatches } = await admin
    .from("dispatch")
    .select("id, campaign_id")
    .in("campaign_id", ids);

  const dispatchIds = (dispatches ?? []).map((d) => d.id);
  const sentByCampaign = new Map<string, number>();
  const countByCampaign = new Map<string, number>();
  for (const d of dispatches ?? []) {
    if (!d.campaign_id) continue;
    countByCampaign.set(d.campaign_id, (countByCampaign.get(d.campaign_id) ?? 0) + 1);
  }

  if (dispatchIds.length > 0) {
    const campaignByDispatch = new Map(
      (dispatches ?? []).map((d) => [d.id, d.campaign_id] as const),
    );
    const { data: recipients } = await admin
      .from("dispatch_recipient")
      .select("dispatch_id, status")
      .in("dispatch_id", dispatchIds)
      .in("status", ["sent", "delivered", "read"]);
    for (const r of recipients ?? []) {
      const campaignId = campaignByDispatch.get(r.dispatch_id);
      if (!campaignId) continue;
      sentByCampaign.set(campaignId, (sentByCampaign.get(campaignId) ?? 0) + 1);
    }
  }

  return campaigns.map((c) => {
    const template = (c as { template?: { name: string; status: string } | null }).template;
    const flow = (c as { flow?: { name: string } | null }).flow;
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      status: c.status,
      templateId: c.template_id,
      templateName: template?.name ?? null,
      templateStatus: template?.status ?? null,
      flowId: c.flow_id,
      flowName: flow?.name ?? null,
      broadcastCount: countByCampaign.get(c.id) ?? 0,
      sentCount: sentByCampaign.get(c.id) ?? 0,
      createdAt: c.created_at,
    };
  });
}

/** Campanhas que podem ser transmitidas: ativas e com template aprovado. */
export async function listSendableCampaigns(workspaceId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("campaign")
    .select("id, name, template_id, flow_id, template:template_id(name, status, language)")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("name", { ascending: true });

  return (data ?? [])
    .map((c) => {
      const template = (c as { template?: { name: string; status: string } | null }).template;
      return {
        id: c.id,
        name: c.name,
        templateId: c.template_id,
        templateName: template?.name ?? null,
        templateStatus: template?.status ?? null,
        flowId: c.flow_id,
      };
    })
    .filter((c) => c.templateId !== null && c.templateStatus === "APPROVED");
}
