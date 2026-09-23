import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getWabaInfo, listBusinessWabas, listPhoneNumbers } from "@/lib/meta/graph-api";

export type RecoverableWaba = {
  wabaId: string;
  name: string | null;
  ownerBusinessName: string | null;
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

/**
 * Contas que existem na Meta e não estão ligadas a nenhum cliente aqui.
 *
 * O Login Integrado compartilha a conta do cliente com o nosso negócio no
 * momento em que ele conclui o cadastro. Quando o passo seguinte falha — e
 * falhava, quando o popup não conseguia avisar qual era a conta — a conta fica
 * existindo lá, completa, e invisível aqui. Era isso que obrigava a refazer o
 * cadastro inteiro ou a colar credencial na mão.
 */
export async function findUnlinkedWabas(): Promise<RecoverableWaba[]> {
  const [credentials, alreadyLinked] = await Promise.all([
    storedBusinessCredentials(),
    connectedWabaIds(),
  ]);

  const candidates = new Map<string, string>(); // wabaId → credencial que a alcança
  for (const { businessId, token } of credentials) {
    const wabas = await listBusinessWabas(businessId, token);
    for (const waba of wabas) {
      if (alreadyLinked.has(waba.id)) continue;
      if (!candidates.has(waba.id)) candidates.set(waba.id, token);
    }
  }

  const out: RecoverableWaba[] = [];
  for (const [wabaId, token] of candidates) {
    try {
      const [info, phones] = await Promise.all([
        getWabaInfo(wabaId, token),
        listPhoneNumbers(wabaId, token),
      ]);
      // Sem número não há o que conectar — normalmente é conta de teste ou um
      // cadastro abandonado antes da verificação.
      if (phones.length === 0) continue;
      out.push({
        wabaId,
        name: info.name ?? null,
        ownerBusinessName: info.owner_business_info?.name ?? null,
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
