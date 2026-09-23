import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getWabaHealthStatus,
  getWabaInfo,
  listPhoneNumbers,
  subscribeAppToWaba,
} from "@/lib/meta/graph-api";

export type LinkWabaParams = {
  workspaceId: string;
  wabaId: string;
  accessToken: string;
  connectedBy: string;
  connectionMethod: "embedded_signup" | "coexistence" | "manual";
  /** Números a registrar na Cloud API; vazio deixa o registro pra depois. */
  registerPhoneNumberIds?: string[];
  /** PIN por número, quando o chamador já gerou um. */
  pinByPhoneNumberId?: Map<string, { pin: string; registered: boolean }>;
};

/**
 * Grava a conexão de uma WABA num workspace: conexão, números e inscrição nos
 * webhooks.
 *
 * Um único lugar de propósito — o Login Integrado, a conexão manual e a
 * recuperação de uma conta órfã precisam gravar exatamente a mesma coisa, e
 * quando isso vivia copiado em cada ação uma delas sempre saía diferente.
 */
export async function linkWabaToWorkspace(
  params: LinkWabaParams,
): Promise<{ ok: true; connectionId: string } | { ok: false; error: string }> {
  const { workspaceId, wabaId, accessToken } = params;

  const wabaInfo = await getWabaInfo(wabaId, accessToken);
  const phoneNumbers = await listPhoneNumbers(wabaId, accessToken);
  const healthStatus = await getWabaHealthStatus(wabaId, accessToken);

  const admin = createAdminClient();

  const { data: connectionRow, error: upsertError } = await admin
    .from("workspace_meta_connection")
    .upsert(
      {
        workspace_id: workspaceId,
        waba_id: wabaId,
        business_id: wabaInfo.owner_business_info?.id ?? null,
        business_name: wabaInfo.owner_business_info?.name ?? wabaInfo.name ?? null,
        access_token: accessToken,
        connected_at: new Date().toISOString(),
        connected_by: params.connectedBy,
        updated_at: new Date().toISOString(),
        connection_method: params.connectionMethod,
        health_status: healthStatus as never,
        health_synced_at: healthStatus ? new Date().toISOString() : null,
      },
      { onConflict: "workspace_id,waba_id" },
    )
    .select("id")
    .single();

  if (upsertError || !connectionRow) {
    return { ok: false, error: `Falha ao salvar conexão: ${upsertError?.message}` };
  }
  const connectionId = connectionRow.id;

  // Carrega pin/is_registered anteriores dessa MESMA conexão antes de apagar as
  // linhas — reaproveitar o pin evita quebrar o /register de um número que já
  // tem verificação em duas etapas ativada.
  const { data: existingPhones } = await admin
    .from("workspace_phone_number")
    .select("phone_number_id, pin, is_registered")
    .eq("connection_id", connectionId);
  const existingByPhoneId = new Map(
    (existingPhones ?? []).map((p) => [p.phone_number_id, p]),
  );

  const { error: deleteError } = await admin
    .from("workspace_phone_number")
    .delete()
    .eq("connection_id", connectionId);
  if (deleteError) {
    return { ok: false, error: `Falha ao limpar phones antigos: ${deleteError.message}` };
  }

  if (phoneNumbers.length > 0) {
    const { error: insertError } = await admin.from("workspace_phone_number").insert(
      phoneNumbers.map((p) => {
        const registration = params.pinByPhoneNumberId?.get(p.id);
        const existing = existingByPhoneId.get(p.id);
        return {
          workspace_id: workspaceId,
          connection_id: connectionId,
          phone_number_id: p.id,
          display_phone_number: p.display_phone_number,
          verified_name: p.verified_name ?? null,
          quality_rating: p.quality_rating ?? null,
          code_verification_status: p.code_verification_status ?? null,
          messaging_limit_tier: p.messaging_limit_tier ?? null,
          meta_status: p.status ?? null,
          platform_type: p.platform_type ?? null,
          is_on_biz_app: p.is_on_biz_app ?? null,
          // Um número que a Meta já mostra CONNECTED está registrado na Cloud
          // API — dizer que não está fazia a tela pedir um registro
          // desnecessário logo depois de conectar.
          is_registered:
            registration?.registered ??
            existing?.is_registered ??
            p.status === "CONNECTED",
          pin: registration?.pin ?? existing?.pin ?? null,
          last_synced_at: new Date().toISOString(),
        };
      }),
    );
    if (insertError) {
      return { ok: false, error: `Falha ao salvar phone numbers: ${insertError.message}` };
    }
  }

  // Sem isso nenhuma mensagem chega: é esta chamada que faz a Meta mandar os
  // webhooks dessa conta pro nosso app.
  try {
    await subscribeAppToWaba(wabaId, accessToken);
  } catch (err) {
    console.warn("subscribeAppToWaba failed", err);
  }

  return { ok: true, connectionId };
}
