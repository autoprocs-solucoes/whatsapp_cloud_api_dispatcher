"use server";

import { randomInt } from "crypto";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForToken,
  getWabaInfo,
  GraphApiError,
  listPhoneNumbers,
  registerPhoneNumber,
  subscribeAppToWaba,
} from "@/lib/meta/graph-api";
import {
  completeMetaSignupSchema,
  disconnectMetaSchema,
  registerPhoneNumberSchema,
  syncMetaConnectionSchema,
} from "@/features/meta/schemas";

// PIN de 6 dígitos pro registro na Cloud API (two-step verification).
function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireOwnership(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Não autenticado" };

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("workspace_member")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || membership.role !== "owner") {
    return { ok: false as const, error: "Apenas owners podem gerenciar a conexão Meta" };
  }
  return { ok: true as const, user };
}

// Registrar um número já conectado é uma ação de baixo risco (não expõe nem
// troca credenciais, só corrige um estado inconsistente do lado da Meta) —
// por isso qualquer membro do workspace pode fazer, não só o owner.
async function requireMembership(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Não autenticado" };

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("workspace_member")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return { ok: false as const, error: "Você não faz parte deste workspace" };
  }
  return { ok: true as const, user };
}

// Conecta uma conta Meta (WABA) ao workspace. Um workspace pode ter várias
// contas conectadas — reconectar a MESMA WABA (mesmo waba_id) atualiza a
// linha existente (token/nome), reconectar uma WABA diferente ADICIONA uma
// nova conexão em vez de substituir a anterior.
export async function completeMetaSignupAction(input: unknown): Promise<ActionResult> {
  const parsed = completeMetaSignupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos do Embedded Signup" };
  }
  const { workspaceId, code, wabaId, phoneNumberIds, connectionMethod } = parsed.data;

  const auth = await requireOwnership(workspaceId);
  if (!auth.ok) return auth;

  try {
    const accessToken = await exchangeCodeForToken(code);
    const wabaInfo = await getWabaInfo(wabaId, accessToken);
    const phoneNumbers = await listPhoneNumbers(wabaId, accessToken);

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
          connected_by: auth.user.id,
          updated_at: new Date().toISOString(),
          connection_method: connectionMethod,
        },
        { onConflict: "workspace_id,waba_id" },
      )
      .select("id")
      .single();

    if (upsertError || !connectionRow) {
      return { ok: false, error: `Falha ao salvar conexão: ${upsertError?.message}` };
    }
    const connectionId = connectionRow.id;

    // Carrega pin/is_registered anteriores dessa MESMA conexão (se essa era
    // uma reconexão da mesma WABA) antes de apagar as linhas — reaproveitar
    // o pin evita quebrar o /register de um número que já tem verificação em
    // duas etapas ativada.
    const { data: existingPhones } = await admin
      .from("workspace_phone_number")
      .select("phone_number_id, pin, is_registered")
      .eq("connection_id", connectionId);
    const existingByPhoneId = new Map(
      (existingPhones ?? []).map((p) => [p.phone_number_id, p]),
    );

    // Registra na Cloud API o(s) número(s) selecionado(s) no popup. Passo
    // crítico da Coexistência: o registro automático da Meta às vezes falha
    // silenciosamente, e sem ele o número não consegue enviar mensagem via
    // Cloud API mesmo com o Embedded Signup concluído.
    const registrationByPhoneId = new Map<string, { pin: string; registered: boolean }>();
    for (const phoneNumberId of phoneNumberIds ?? []) {
      const pin = existingByPhoneId.get(phoneNumberId)?.pin || generatePin();
      const result = await registerPhoneNumber(phoneNumberId, accessToken, pin);
      if (!result.ok) {
        console.warn(`[completeMetaSignupAction] register não-ok (${result.status}) para ${phoneNumberId}:`, result.message);
      }
      registrationByPhoneId.set(phoneNumberId, { pin, registered: result.ok });
    }

    // Substitui os phone numbers DESSA conexão (limpa antigos, insere
    // atuais) — não mexe nos phone numbers de outras conexões do workspace.
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
          const registration = registrationByPhoneId.get(p.id);
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
            is_registered: registration?.registered ?? existing?.is_registered ?? false,
            pin: registration?.pin ?? existing?.pin ?? null,
            last_synced_at: new Date().toISOString(),
          };
        }),
      );
      if (insertError) {
        return { ok: false, error: `Falha ao salvar phone numbers: ${insertError.message}` };
      }
    }

    // Subscreve app pro WABA receber webhooks. Falha aqui não bloqueia conexão.
    try {
      await subscribeAppToWaba(wabaId, accessToken);
    } catch (err) {
      console.warn("subscribeAppToWaba failed", err);
    }

    revalidatePath("/configuracoes");
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof GraphApiError) {
      return { ok: false, error: `Meta Graph API: ${err.message}` };
    }
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message };
  }
}

// Repete o passo de registro na Cloud API pra um número que conectou (via
// Coexistência ou Embedded Signup) mas nunca chegou a registrar de fato
// (erro da Meta "The account is not registered" ao tentar enviar) — comum
// quando o popup do Embedded Signup fecha antes desse passo silencioso
// completar do lado da Meta.
export async function registerPhoneNumberAction(input: unknown): Promise<ActionResult> {
  const parsed = registerPhoneNumberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos" };
  }
  const { workspaceId, phoneNumberRowId } = parsed.data;

  const auth = await requireMembership(workspaceId);
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  const { data: phone } = await admin
    .from("workspace_phone_number")
    .select("id, connection_id, phone_number_id, pin")
    .eq("id", phoneNumberRowId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!phone) {
    return { ok: false, error: "Phone number não encontrado" };
  }

  const { data: connection } = await admin
    .from("workspace_meta_connection")
    .select("access_token")
    .eq("id", phone.connection_id)
    .maybeSingle();
  if (!connection) {
    return { ok: false, error: "Conexão Meta desse número não encontrada" };
  }

  const pin = phone.pin || generatePin();
  const result = await registerPhoneNumber(phone.phone_number_id, connection.access_token, pin);
  if (!result.ok) {
    return {
      ok: false,
      error: result.message ?? `Meta recusou o registro (status ${result.status}).`,
    };
  }

  const { error: updateError } = await admin
    .from("workspace_phone_number")
    .update({ is_registered: true, pin })
    .eq("id", phoneNumberRowId);
  if (updateError) {
    return { ok: false, error: `Falha ao salvar status: ${updateError.message}` };
  }

  revalidatePath("/configuracoes");
  return { ok: true, data: undefined };
}

export async function syncMetaConnectionAction(input: unknown): Promise<ActionResult> {
  const parsed = syncMetaConnectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos" };
  }
  const { workspaceId, connectionId } = parsed.data;

  const auth = await requireOwnership(workspaceId);
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  const { data: connection, error: fetchError } = await admin
    .from("workspace_meta_connection")
    .select("waba_id, access_token")
    .eq("id", connectionId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: `Falha ao buscar conexão: ${fetchError.message}` };
  }
  if (!connection) {
    return { ok: false, error: "Conexão Meta não encontrada" };
  }

  try {
    const wabaInfo = await getWabaInfo(connection.waba_id, connection.access_token);
    const phoneNumbers = await listPhoneNumbers(connection.waba_id, connection.access_token);

    const { error: updateError } = await admin
      .from("workspace_meta_connection")
      .update({
        business_id: wabaInfo.owner_business_info?.id ?? null,
        business_name: wabaInfo.owner_business_info?.name ?? wabaInfo.name ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);

    if (updateError) {
      return { ok: false, error: `Falha ao atualizar conexão: ${updateError.message}` };
    }

    await admin.from("workspace_phone_number").delete().eq("connection_id", connectionId);

    if (phoneNumbers.length > 0) {
      const { error: insertError } = await admin.from("workspace_phone_number").insert(
        phoneNumbers.map((p) => ({
          workspace_id: workspaceId,
          connection_id: connectionId,
          phone_number_id: p.id,
          display_phone_number: p.display_phone_number,
          verified_name: p.verified_name ?? null,
          quality_rating: p.quality_rating ?? null,
          code_verification_status: p.code_verification_status ?? null,
          messaging_limit_tier: p.messaging_limit_tier ?? null,
          is_registered: false,
          last_synced_at: new Date().toISOString(),
        })),
      );
      if (insertError) {
        return { ok: false, error: `Falha ao salvar phone numbers: ${insertError.message}` };
      }
    }

    revalidatePath("/configuracoes");
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof GraphApiError) {
      const msg = err.payload.error?.message ?? "Erro Meta Graph API";
      if (err.status === 401 || err.status === 403) {
        return { ok: false, error: `Token inválido ou expirado: ${msg}` };
      }
      return { ok: false, error: `Meta Graph API: ${msg}` };
    }
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message };
  }
}

export async function disconnectMetaAction(input: unknown): Promise<ActionResult> {
  const parsed = disconnectMetaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos" };
  }
  const { workspaceId, connectionId } = parsed.data;

  const auth = await requireOwnership(workspaceId);
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  // Phone numbers e templates dessa conexão vão via cascade (connection_id
  // ON DELETE CASCADE) — só precisa apagar a connection.
  const { error } = await admin
    .from("workspace_meta_connection")
    .delete()
    .eq("id", connectionId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/configuracoes");
  return { ok: true, data: undefined };
}
