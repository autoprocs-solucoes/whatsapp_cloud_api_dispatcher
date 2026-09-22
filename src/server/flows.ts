import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveWorkspace } from "@/server/workspace";
import type { Flow, FlowFolder } from "@/lib/supabase/database.types";

export type FlowSummary = {
  id: string;
  name: string;
  description: string | null;
  folderId: string | null;
  status: "draft" | "published";
  /** Quantos blocos o fluxo tem — dá noção de tamanho sem abrir o canvas. */
  stepCount: number;
  updatedAt: string;
};

function stepCount(graph: unknown): number {
  if (!graph || typeof graph !== "object") return 0;
  const nodes = (graph as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return 0;
  // O nó de início não conta como passo — ele é só o ponto de entrada.
  return nodes.filter((n) => (n as { type?: string })?.type !== "start").length;
}

function toSummary(flow: Flow): FlowSummary {
  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    folderId: flow.folder_id,
    status: flow.status,
    stepCount: stepCount(flow.graph),
    updatedAt: flow.updated_at,
  };
}

export async function listFlows(): Promise<{
  folders: FlowFolder[];
  flows: FlowSummary[];
}> {
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();

  const [foldersRes, flowsRes] = await Promise.all([
    admin
      .from("flow_folder")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true }),
    admin
      .from("flow")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false }),
  ]);

  return {
    folders: foldersRes.data ?? [],
    flows: (flowsRes.data ?? []).map(toSummary),
  };
}

export async function getFlow(id: string): Promise<Flow | null> {
  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();
  const { data } = await admin
    .from("flow")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  return data ?? null;
}

/** Fluxos publicados — é o que Campanha e Transmissão podem disparar. */
export async function listPublishedFlows(workspaceId: string): Promise<FlowSummary[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("flow")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .order("name", { ascending: true });
  return (data ?? []).map(toSummary);
}
