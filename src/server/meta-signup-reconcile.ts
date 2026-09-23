import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { listClientWabas } from "@/lib/meta/graph-api";
import { linkWabaToWorkspace } from "@/server/meta-link";

/**
 * Fecha o fluxo do login integrado pelo lado da Meta, sem depender do navegador.
 *
 * A cadeia que o cliente enxerga é: clicou → configurou → conectado na Meta →
 * conectado aqui. O último elo dependia de uma mensagem do popup chegar de
 * volta ao navegador, e essa mensagem se perde: o cliente fecha a janela no
 * último clique, a aba recarrega, a rede cai. Quando ela sumia, o cliente
 * terminava tudo — número registrado, cartão cadastrado — e do lado de cá não
 * aparecia nada.
 *
 * Mas a Meta deixa um rastro que não depende de navegador nenhum: no instante
 * em que o cliente conclui, a conta dele passa a ser compartilhada com o nosso
 * negócio. Então basta olhar quais contas existiam antes de ele começar e
 * quais existem depois. A que apareceu no meio é dele.
 *
 * Comparar com o "antes" é o que torna isso exato: nada de adivinhar por nome,
 * e nenhuma chance de pegar a conta de outro cliente.
 */

type BusinessCredential = { businessId: string; token: string };

async function storedBusinessCredentials(): Promise<BusinessCredential[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_meta_connection")
    .select("business_id, access_token, connected_at")
    .not("business_id", "is", null)
    .order("connected_at", { ascending: false });

  const byBusiness = new Map<string, string>();
  for (const row of data ?? []) {
    if (!row.business_id) continue;
    if (!byBusiness.has(row.business_id)) byBusiness.set(row.business_id, row.access_token);
  }
  return Array.from(byBusiness, ([businessId, token]) => ({ businessId, token }));
}

/** Contas de cliente que os nossos negócios enxergam agora, e por qual
 * credencial cada uma é alcançável. */
async function clientWabasNow(): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const { businessId, token } of await storedBusinessCredentials()) {
    for (const waba of await listClientWabas(businessId, token)) {
      if (!found.has(waba.id)) found.set(waba.id, token);
    }
  }
  return found;
}

async function linkedWabaIds(): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin.from("workspace_meta_connection").select("waba_id");
  return new Set((data ?? []).map((r) => r.waba_id));
}

/**
 * Fotografa o que já existia antes de o cliente começar.
 *
 * Roda antes de abrir o popup, de propósito: depois já não dá pra saber o que
 * é novo.
 */
export async function snapshotBeforeSignup(params: {
  workspaceId: string;
  userId: string;
  method: string;
}): Promise<void> {
  try {
    const known = Array.from((await clientWabasNow()).keys());
    const admin = createAdminClient();
    await admin.from("meta_signup_attempt").insert({
      workspace_id: params.workspaceId,
      user_id: params.userId,
      stage: "launch",
      method: params.method,
      detail: { knownWabaIds: known } as never,
    });
  } catch (e) {
    // Sem a foto, o caminho normal (o code do popup) continua valendo.
    console.error("[meta] não consegui fotografar as contas antes do signup:", e);
  }
}

export type ReconcileResult =
  | { status: "connected"; wabaId: string }
  | { status: "already" }
  | { status: "pending" }
  | { status: "ambiguous"; wabaIds: string[] };

/**
 * Procura a conta que nasceu durante a tentativa deste cliente e conecta.
 *
 * Idempotente: se o caminho normal já gravou a conexão, não faz nada.
 */
export async function reconcileSignup(params: {
  workspaceId: string;
  userId: string;
}): Promise<ReconcileResult> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("workspace_meta_connection")
    .select("id")
    .eq("workspace_id", params.workspaceId)
    .limit(1)
    .maybeSingle();
  if (existing) return { status: "already" };

  // A tentativa mais recente deste cliente, dentro de um prazo que faz sentido
  // pra alguém que está no meio do cadastro.
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: attempt } = await admin
    .from("meta_signup_attempt")
    .select("detail, created_at")
    .eq("workspace_id", params.workspaceId)
    .eq("stage", "launch")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!attempt) return { status: "pending" };

  const detail = attempt.detail as { knownWabaIds?: string[] } | null;
  const known = new Set(detail?.knownWabaIds ?? []);

  const [current, linked] = await Promise.all([clientWabasNow(), linkedWabaIds()]);

  const novas: string[] = [];
  for (const wabaId of current.keys()) {
    if (known.has(wabaId) || linked.has(wabaId)) continue;
    novas.push(wabaId);
  }

  if (novas.length === 0) return { status: "pending" };
  // Duas contas nascendo durante a mesma tentativa não deveria acontecer.
  // Se acontecer, não é hora de chutar qual é a do cliente.
  if (novas.length > 1) return { status: "ambiguous", wabaIds: novas };

  const wabaId = novas[0]!;
  const token = current.get(wabaId)!;

  const result = await linkWabaToWorkspace({
    workspaceId: params.workspaceId,
    wabaId,
    accessToken: token,
    connectedBy: params.userId,
    connectionMethod: "coexistence",
  });
  if (!result.ok) throw new Error(result.error);

  await admin.from("meta_signup_attempt").insert({
    workspace_id: params.workspaceId,
    user_id: params.userId,
    stage: "saved",
    method: "reconcile",
    waba_id: wabaId,
  });

  return { status: "connected", wabaId };
}
