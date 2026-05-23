"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForToken,
  getWabaInfo,
  GraphApiError,
  listPhoneNumbers,
  subscribeAppToWaba,
} from "@/lib/meta/graph-api";
import {
  completeMetaSignupSchema,
  connectMetaManuallySchema,
  disconnectMetaSchema,
  syncMetaConnectionSchema,
} from "@/features/meta/schemas";

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

export async function completeMetaSignupAction(input: unknown): Promise<ActionResult> {
  const parsed = completeMetaSignupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos do Embedded Signup" };
  }
  const { workspaceId, code, wabaId } = parsed.data;

  const auth = await requireOwnership(workspaceId);
  if (!auth.ok) return auth;

  try {
    const accessToken = await exchangeCodeForToken(code);
    const wabaInfo = await getWabaInfo(wabaId, accessToken);
    const phoneNumbers = await listPhoneNumbers(wabaId, accessToken);

    const admin = createAdminClient();

    const { error: upsertError } = await admin
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
        },
        { onConflict: "workspace_id" },
      );

    if (upsertError) {
      return { ok: false, error: `Falha ao salvar conexão: ${upsertError.message}` };
    }

    // Substitui phone numbers (limpa antigos, insere atuais).
    const { error: deleteError } = await admin
      .from("workspace_phone_number")
      .delete()
      .eq("workspace_id", workspaceId);
    if (deleteError) {
      return { ok: false, error: `Falha ao limpar phones antigos: ${deleteError.message}` };
    }

    if (phoneNumbers.length > 0) {
      const { error: insertError } = await admin.from("workspace_phone_number").insert(
        phoneNumbers.map((p) => ({
          workspace_id: workspaceId,
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

export async function connectMetaManuallyAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult & { fieldErrors?: Record<string, string> }> {
  const parsed = connectMetaManuallySchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    wabaId: formData.get("wabaId"),
    accessToken: formData.get("accessToken"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Verifique os campos",
      fieldErrors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""]),
      ),
    };
  }
  const { workspaceId, wabaId, accessToken } = parsed.data;

  const auth = await requireOwnership(workspaceId);
  if (!auth.ok) return auth;

  try {
    // Valida o token + busca info do WABA.
    const wabaInfo = await getWabaInfo(wabaId, accessToken);
    const phoneNumbers = await listPhoneNumbers(wabaId, accessToken);

    const admin = createAdminClient();

    const { error: upsertError } = await admin
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
        },
        { onConflict: "workspace_id" },
      );

    if (upsertError) {
      return { ok: false, error: `Falha ao salvar conexão: ${upsertError.message}` };
    }

    await admin.from("workspace_phone_number").delete().eq("workspace_id", workspaceId);

    if (phoneNumbers.length > 0) {
      const { error: insertError } = await admin.from("workspace_phone_number").insert(
        phoneNumbers.map((p) => ({
          workspace_id: workspaceId,
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

    // Subscreve app pro WABA (não bloqueia em erro).
    try {
      await subscribeAppToWaba(wabaId, accessToken);
    } catch (err) {
      console.warn("subscribeAppToWaba failed", err);
    }

    revalidatePath("/configuracoes");
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof GraphApiError) {
      const msg = err.payload.error?.message ?? "Erro Meta Graph API";
      if (err.status === 401 || err.status === 403) {
        return { ok: false, error: `Token inválido ou sem permissões: ${msg}` };
      }
      if (err.status === 404) {
        return { ok: false, error: `WABA ID não encontrado: ${msg}` };
      }
      return { ok: false, error: `Meta Graph API: ${msg}` };
    }
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message };
  }
}

export async function syncMetaConnectionAction(input: unknown): Promise<ActionResult> {
  const parsed = syncMetaConnectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos" };
  }
  const { workspaceId } = parsed.data;

  const auth = await requireOwnership(workspaceId);
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  const { data: connection, error: fetchError } = await admin
    .from("workspace_meta_connection")
    .select("waba_id, access_token")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: `Falha ao buscar conexão: ${fetchError.message}` };
  }
  if (!connection) {
    return { ok: false, error: "Workspace não tem conexão Meta" };
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
      .eq("workspace_id", workspaceId);

    if (updateError) {
      return { ok: false, error: `Falha ao atualizar conexão: ${updateError.message}` };
    }

    await admin.from("workspace_phone_number").delete().eq("workspace_id", workspaceId);

    if (phoneNumbers.length > 0) {
      const { error: insertError } = await admin.from("workspace_phone_number").insert(
        phoneNumbers.map((p) => ({
          workspace_id: workspaceId,
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
  const { workspaceId } = parsed.data;

  const auth = await requireOwnership(workspaceId);
  if (!auth.ok) return auth;

  const admin = createAdminClient();

  // Phone numbers vão por cascade do workspace, mas como aqui só deletamos a
  // connection (não o workspace), removemos explicitamente.
  await admin.from("workspace_phone_number").delete().eq("workspace_id", workspaceId);
  const { error } = await admin
    .from("workspace_meta_connection")
    .delete()
    .eq("workspace_id", workspaceId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/configuracoes");
  return { ok: true, data: undefined };
}
