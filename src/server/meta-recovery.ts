import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getWabaInfo, listClientWabas, listPhoneNumbers } from "@/lib/meta/graph-api";

export type RecoverableWaba = {
  wabaId: string;
  name: string | null;
  ownerBusinessName: string | null;
  /** Por que esta conta foi atribuída a este cliente. */
  matchedBy: "tentativa" | "nome";
  phones: { display: string; verifiedName: string | null; status: string | null }[];
};

type BusinessCredential = { businessId: string; token: string };

/**
 * Credenciais de negócio que já temos guardadas, uma por negócio.
 *
 * Elas nunca saem daqui: a tela recebe só o nome e o número da conta.
 */
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

async function connectedWabaIds(): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin.from("workspace_meta_connection").select("waba_id");
  return new Set((data ?? []).map((r) => r.waba_id));
}

/** Sem acento, sem pontuação, minúsculo — "Tj Assessoria Contábil" e "Tj
 * Assessoria Contabil" são a mesma empresa. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Palavras que não distinguem uma empresa de outra. */
const NOISE = new Set([
  "ltda",
  "me",
  "eireli",
  "sa",
  "comercio",
  "servicos",
  "negocios",
  "assessoria",
  "contabil",
  "contabilidade",
  "solucoes",
  "empresa",
  "grupo",
  "do",
  "da",
  "de",
  "dos",
  "das",
  "e",
]);

/**
 * O nome do negócio dono da conta bate com o nome do cliente?
 *
 * Só uma coincidência forte conta: nome igual, um contendo o outro, ou duas
 * palavras próprias em comum. Errar aqui é oferecer a conta de um cliente pra
 * dentro de outro.
 */
function sameCompany(workspaceName: string, businessName: string | null): boolean {
  if (!businessName) return false;
  const a = normalize(workspaceName);
  const b = normalize(businessName);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const wordsOf = (t: string) =>
    new Set(t.split(" ").filter((w) => w.length >= 3 && !NOISE.has(w)));
  const wa = wordsOf(a);
  const wb = wordsOf(b);
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared >= 2;
}

/**
 * Contas deste cliente que concluíram o cadastro na Meta e não viraram conexão.
 *
 * Duas regras estreitas de propósito, porque esta lista aparece dentro da tela
 * de um cliente:
 *
 * 1. Só contas de clientes (`client_whatsapp_business_accounts`) — as contas da
 *    própria Autoprocs nunca entram. Elas chegaram aqui por outro caminho e não
 *    têm nada que ser oferecidas dentro de um cliente.
 * 2. Só as que são reconhecidamente deste cliente: ou o WABA aparece no rastro
 *    de tentativa dele, ou o negócio dono tem o nome dele.
 *
 * Sem isso a tela do TJ listava a conta da Advisory e a de outros clientes — e
 * um clique errado ligaria o WhatsApp de um no cliente do outro.
 */
export async function findUnlinkedWabas(
  workspaceId: string,
  workspaceName: string,
): Promise<RecoverableWaba[]> {
  const admin = createAdminClient();

  const [credentials, alreadyLinked, attempts] = await Promise.all([
    storedBusinessCredentials(),
    connectedWabaIds(),
    admin
      .from("meta_signup_attempt")
      .select("waba_id")
      .eq("workspace_id", workspaceId)
      .not("waba_id", "is", null),
  ]);

  const attemptedWabaIds = new Set(
    (attempts.data ?? []).map((a) => a.waba_id).filter((id): id is string => Boolean(id)),
  );

  const candidates = new Map<string, string>(); // wabaId → credencial que a alcança
  for (const { businessId, token } of credentials) {
    for (const waba of await listClientWabas(businessId, token)) {
      if (alreadyLinked.has(waba.id)) continue;
      if (!candidates.has(waba.id)) candidates.set(waba.id, token);
    }
  }

  const out: RecoverableWaba[] = [];
  for (const [wabaId, token] of candidates) {
    try {
      const info = await getWabaInfo(wabaId, token);
      const ownerBusinessName = info.owner_business_info?.name ?? null;

      const matchedBy: RecoverableWaba["matchedBy"] | null = attemptedWabaIds.has(wabaId)
        ? "tentativa"
        : sameCompany(workspaceName, ownerBusinessName)
          ? "nome"
          : null;
      if (!matchedBy) continue;

      const phones = await listPhoneNumbers(wabaId, token);
      // Sem número não há o que conectar — conta abandonada antes da
      // verificação, ou de teste.
      if (phones.length === 0) continue;

      out.push({
        wabaId,
        name: info.name ?? null,
        ownerBusinessName,
        matchedBy,
        phones: phones.map((p) => ({
          display: p.display_phone_number,
          verifiedName: p.verified_name ?? null,
          status: p.status ?? null,
        })),
      });
    } catch {
      // Conta que a credencial não alcança mais: não é recuperável.
    }
  }
  return out;
}

/** A credencial guardada que consegue falar por essa WABA, ou nada. */
export async function credentialForWaba(wabaId: string): Promise<string | null> {
  for (const { token } of await storedBusinessCredentials()) {
    try {
      await getWabaInfo(wabaId, token);
      return token;
    } catch {
      // Próximo negócio.
    }
  }
  return null;
}
