import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  GraphApiError,
  sendInteractiveButtons,
  sendListMessage,
  sendMediaMessage,
  sendTextMessage,
} from "@/lib/meta/graph-api";
import {
  NEXT_HANDLE,
  parseGraph,
  type FlowGraph,
  type FlowNode,
  type MessageNodeData,
} from "@/features/flows/schemas";
import type { FlowRun } from "@/lib/supabase/database.types";

/**
 * Motor do fluxo: leva um contato de bloco em bloco.
 *
 * O caminhar para em dois lugares — bloco de mensagem com botões (espera a
 * resposta) e bloco de atraso (espera a hora). Fora isso ele segue as ligações
 * até acabar o desenho. Estado fica em `flow_run`, então nada depende de
 * processo vivo: a resposta chega pelo webhook e a hora chega pelo tick.
 */

type Admin = ReturnType<typeof createAdminClient>;

const MAX_STEPS_PER_TURN = 20;

function nodeById(graph: FlowGraph, id: string | null): FlowNode | null {
  if (!id) return null;
  return graph.nodes.find((n) => n.id === id) ?? null;
}

function nextNodeId(graph: FlowGraph, fromId: string, handle: string): string | null {
  const edge = graph.edges.find(
    (e) => e.source === fromId && (e.sourceHandle ?? NEXT_HANDLE) === handle,
  );
  return edge?.target ?? null;
}

function delayMs(amount: number, unit: "minutes" | "hours" | "days"): number {
  const factor = unit === "minutes" ? 60_000 : unit === "hours" ? 3_600_000 : 86_400_000;
  return amount * factor;
}

async function accessToken(admin: Admin, connectionId: string): Promise<string | null> {
  const { data } = await admin
    .from("workspace_meta_connection")
    .select("access_token")
    .eq("id", connectionId)
    .maybeSingle();
  return data?.access_token ?? null;
}

/** Envia o bloco de mensagem. Mídia vai antes do texto, como no WhatsApp. */
async function sendMessageNode(
  run: FlowRun,
  token: string,
  data: MessageNodeData,
): Promise<void> {
  const common = {
    phoneNumberId: run.phone_number_id,
    token,
    to: run.phone_e164,
  };

  if (data.media?.url) {
    await sendMediaMessage({
      ...common,
      kind: data.media.type,
      link: data.media.url,
      caption: data.buttons.length === 0 ? data.body || null : null,
      filename: data.media.filename ?? null,
    });
    // Com mídia legendada e sem botões a mensagem já foi inteira.
    if (data.buttons.length === 0 && data.body) return;
  }

  if (data.buttons.length === 0) {
    if (!data.body) return;
    await sendTextMessage({ ...common, text: data.body });
    return;
  }

  if (data.buttons.length <= 3) {
    await sendInteractiveButtons({
      ...common,
      body: data.body || "Escolha uma opção",
      header: data.title || null,
      footer: data.footer || null,
      buttons: data.buttons.map((b) => ({ id: b.id, title: b.label })),
    });
    return;
  }

  await sendListMessage({
    ...common,
    body: data.body || "Escolha uma opção",
    header: data.title || null,
    footer: data.footer || null,
    buttonLabel: data.listTitle || "Ver opções",
    rows: data.buttons.map((b) => ({ id: b.id, title: b.label })),
  });
}

async function finish(
  admin: Admin,
  runId: string,
  status: "done" | "failed",
  error?: string,
): Promise<void> {
  await admin
    .from("flow_run")
    .update({ status, last_error: error ?? null, resume_at: null, current_node_id: null })
    .eq("id", runId);
}

/**
 * Anda com a execução a partir do bloco em que ela está. Para quando precisa
 * esperar alguma coisa, quando acaba o desenho, ou quando bate o teto de
 * passos por rodada (proteção contra fluxo em ciclo).
 */
export async function advanceFlowRun(run: FlowRun): Promise<void> {
  const admin = createAdminClient();

  const { data: flow } = await admin
    .from("flow")
    .select("graph, status")
    .eq("id", run.flow_id)
    .maybeSingle();
  if (!flow) {
    await finish(admin, run.id, "failed", "Fluxo não existe mais");
    return;
  }

  const token = await accessToken(admin, run.connection_id);
  if (!token) {
    await finish(admin, run.id, "failed", "Conexão Meta não encontrada");
    return;
  }

  const graph = parseGraph(flow.graph);
  let currentId = run.current_node_id;

  for (let step = 0; step < MAX_STEPS_PER_TURN; step++) {
    const node = nodeById(graph, currentId);
    if (!node) {
      await finish(admin, run.id, "done");
      return;
    }

    if (node.type === "start" || node.data.kind === "start") {
      currentId = nextNodeId(graph, node.id, NEXT_HANDLE);
      continue;
    }

    if (node.data.kind === "delay") {
      const resumeAt =
        node.data.mode === "duration"
          ? new Date(Date.now() + delayMs(node.data.amount, node.data.unit))
          : node.data.at
            ? new Date(node.data.at)
            : null;

      // Data já vencida: o bloco não executa pra quem chegou tarde, segue reto.
      if (!resumeAt || resumeAt.getTime() <= Date.now()) {
        currentId = nextNodeId(graph, node.id, NEXT_HANDLE);
        continue;
      }

      await admin
        .from("flow_run")
        .update({
          status: "waiting_time",
          current_node_id: node.id,
          resume_at: resumeAt.toISOString(),
        })
        .eq("id", run.id);
      return;
    }

    if (node.data.kind === "message") {
      try {
        await sendMessageNode(run, token, node.data);
      } catch (e) {
        const message = e instanceof GraphApiError ? e.message : "Falha ao enviar mensagem";
        await finish(admin, run.id, "failed", message);
        return;
      }

      if (node.data.buttons.length > 0) {
        await admin
          .from("flow_run")
          .update({ status: "waiting_reply", current_node_id: node.id, resume_at: null })
          .eq("id", run.id);
        return;
      }

      currentId = nextNodeId(graph, node.id, NEXT_HANDLE);
      continue;
    }

    // Tipo desconhecido (desenho de uma versão mais nova do editor): para em
    // vez de adivinhar.
    await finish(admin, run.id, "failed", `Bloco desconhecido: ${node.type}`);
    return;
  }

  // Bateu o teto: guarda onde parou e deixa o próximo tick continuar.
  await admin
    .from("flow_run")
    .update({
      status: "waiting_time",
      current_node_id: currentId,
      resume_at: new Date(Date.now() + 60_000).toISOString(),
    })
    .eq("id", run.id);
}

export type StartFlowRunParams = {
  workspaceId: string;
  flowId: string;
  connectionId: string;
  phoneNumberId: string;
  phoneE164: string;
  contactId?: string | null;
  campaignId?: string | null;
  dispatchId?: string | null;
};

/**
 * Põe um contato no começo do fluxo. Se ele já está numa execução aberta,
 * mantém a que existe — duas conversas automáticas ao mesmo tempo com a mesma
 * pessoa é o caminho pro bloqueio do número.
 */
export async function startFlowRun(
  params: StartFlowRunParams,
): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("flow_run")
    .select("id")
    .eq("workspace_id", params.workspaceId)
    .eq("phone_e164", params.phoneE164)
    .in("status", ["active", "waiting_reply", "waiting_time"])
    .maybeSingle();
  if (existing) return { ok: false, error: "Contato já está num fluxo" };

  const { data: flow } = await admin
    .from("flow")
    .select("graph, status")
    .eq("id", params.flowId)
    .eq("workspace_id", params.workspaceId)
    .maybeSingle();
  if (!flow) return { ok: false, error: "Fluxo não encontrado" };
  if (flow.status !== "published") return { ok: false, error: "Fluxo não está publicado" };

  const graph = parseGraph(flow.graph);
  const start = graph.nodes.find((n) => n.type === "start");

  const { data: run, error } = await admin
    .from("flow_run")
    .insert({
      workspace_id: params.workspaceId,
      flow_id: params.flowId,
      campaign_id: params.campaignId ?? null,
      dispatch_id: params.dispatchId ?? null,
      contact_id: params.contactId ?? null,
      phone_e164: params.phoneE164,
      phone_number_id: params.phoneNumberId,
      connection_id: params.connectionId,
      current_node_id: start?.id ?? null,
      status: "active",
    })
    .select("*")
    .single();
  if (error || !run) return { ok: false, error: error?.message ?? "Falha ao iniciar o fluxo" };

  await advanceFlowRun(run);
  return { ok: true, runId: run.id };
}

/**
 * Resposta do contato. Casa o texto com um botão do bloco onde a execução
 * parou e segue por aquela saída. Resposta que não casa com nenhum botão não
 * mexe na execução — a pessoa pode estar falando outra coisa, e o atendente
 * assume dali.
 */
export async function handleFlowReply(params: {
  workspaceId: string;
  phoneE164: string;
  text: string | null;
}): Promise<void> {
  if (!params.text) return;
  const admin = createAdminClient();

  const { data: run } = await admin
    .from("flow_run")
    .select("*")
    .eq("workspace_id", params.workspaceId)
    .eq("phone_e164", params.phoneE164)
    .eq("status", "waiting_reply")
    .maybeSingle();
  if (!run || !run.current_node_id) return;

  const { data: flow } = await admin
    .from("flow")
    .select("graph")
    .eq("id", run.flow_id)
    .maybeSingle();
  if (!flow) return;

  const graph = parseGraph(flow.graph);
  const node = nodeById(graph, run.current_node_id);
  if (!node || node.data.kind !== "message") return;

  const answer = params.text.trim().toLowerCase();
  const button = node.data.buttons.find((b) => b.label.trim().toLowerCase() === answer);
  if (!button) return;

  const targetId = nextNodeId(graph, node.id, button.id);
  if (!targetId) {
    await finish(admin, run.id, "done");
    return;
  }

  await admin
    .from("flow_run")
    .update({ status: "active", current_node_id: targetId })
    .eq("id", run.id);

  await advanceFlowRun({ ...run, status: "active", current_node_id: targetId });
}

/** Execuções cuja hora chegou. Chamado pelo tick (cron). */
export async function resumeDueFlowRuns(limit = 50): Promise<number> {
  const admin = createAdminClient();

  const { data: due } = await admin
    .from("flow_run")
    .select("*")
    .eq("status", "waiting_time")
    .lte("resume_at", new Date().toISOString())
    .order("resume_at", { ascending: true })
    .limit(limit);
  if (!due || due.length === 0) return 0;

  for (const run of due) {
    // Marca como ativa antes de andar: se o tick rodar de novo no meio, ela
    // não aparece mais como vencida.
    const { data: claimed } = await admin
      .from("flow_run")
      .update({ status: "active", resume_at: null })
      .eq("id", run.id)
      .eq("status", "waiting_time")
      .select("*")
      .maybeSingle();
    if (!claimed) continue;

    const nextId = await (async () => {
      const { data: flow } = await admin
        .from("flow")
        .select("graph")
        .eq("id", claimed.flow_id)
        .maybeSingle();
      if (!flow || !claimed.current_node_id) return claimed.current_node_id;
      const graph = parseGraph(flow.graph);
      const node = nodeById(graph, claimed.current_node_id);
      // O bloco de atraso já cumpriu o papel dele: retoma no bloco seguinte.
      if (node?.data.kind === "delay") return nextNodeId(graph, node.id, NEXT_HANDLE);
      return claimed.current_node_id;
    })();

    await advanceFlowRun({ ...claimed, current_node_id: nextId });
  }

  return due.length;
}

/** Tira o contato do fluxo — usado quando um atendente assume a conversa. */
export async function cancelFlowRunForContact(
  workspaceId: string,
  phoneE164: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("flow_run")
    .update({ status: "canceled", resume_at: null })
    .eq("workspace_id", workspaceId)
    .eq("phone_e164", phoneE164)
    .in("status", ["active", "waiting_reply", "waiting_time"]);
}

/**
 * Contato respondeu a uma transmissão: se a campanha dela tem fluxo de
 * continuação e ele ainda não está em nenhum, entra agora.
 *
 * Começar na resposta não é detalhe: é a resposta que abre a janela de 24h, e
 * só dentro dela a Meta entrega mensagem livre e botão interativo. Antes disso
 * o único formato possível é o template — que é justamente o que a transmissão
 * mandou.
 */
export async function startCampaignFlowOnReply(params: {
  workspaceId: string;
  phoneE164: string;
  connectionId: string;
  phoneNumberId: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: active } = await admin
    .from("flow_run")
    .select("id")
    .eq("workspace_id", params.workspaceId)
    .eq("phone_e164", params.phoneE164)
    .in("status", ["active", "waiting_reply", "waiting_time"])
    .maybeSingle();
  if (active) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recipient } = await admin
    .from("dispatch_recipient")
    .select("dispatch_id, contact_id, sent_at")
    .eq("phone_e164", params.phoneE164)
    .in("status", ["sent", "delivered", "read"])
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!recipient) return;

  const { data: dispatch } = await admin
    .from("dispatch")
    .select("id, workspace_id, campaign_id")
    .eq("id", recipient.dispatch_id)
    .maybeSingle();
  if (!dispatch || dispatch.workspace_id !== params.workspaceId || !dispatch.campaign_id) return;

  const { data: campaign } = await admin
    .from("campaign")
    .select("id, flow_id")
    .eq("id", dispatch.campaign_id)
    .maybeSingle();
  if (!campaign?.flow_id) return;

  await startFlowRun({
    workspaceId: params.workspaceId,
    flowId: campaign.flow_id,
    connectionId: params.connectionId,
    phoneNumberId: params.phoneNumberId,
    phoneE164: params.phoneE164,
    contactId: recipient.contact_id,
    campaignId: campaign.id,
    dispatchId: dispatch.id,
  });
}
