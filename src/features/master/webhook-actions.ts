"use server";

import { revalidatePath } from "next/cache";

import {
  getAppWebhookSubscriptions,
  GraphApiError,
  subscribeAppWebhook,
} from "@/lib/meta/graph-api";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { appOrigin } from "@/server/app-origin";
import { getAuthUser } from "@/server/auth-user";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Os eventos de que o Dispatcher depende pra funcionar. */
const WEBHOOK_FIELDS = ["messages"];

async function callbackUrl(): Promise<string> {
  return `${await appOrigin()}/api/webhooks/meta`;
}

async function requireMaster(): Promise<boolean> {
  const user = await getAuthUser();
  if (!user) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profile")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data?.is_superadmin);
}

export type WebhookStatus = {
  /** Endereço que a Meta tem guardado — vazio quando a inscrição caiu. */
  callbackUrl: string | null;
  esperado: string;
  ativo: boolean;
  campos: string[];
  /** Última vez que algum evento da Meta chegou aqui, de qualquer cliente. */
  ultimoEvento: string | null;
};

/**
 * O que a Meta tem configurado hoje, e quando foi a última vez que ela falou
 * com a gente.
 *
 * As duas coisas juntas porque uma sem a outra engana: a configuração pode
 * parecer certa e mesmo assim nada chegar há dias — foi o que aconteceu, e
 * ninguém percebeu porque não havia onde olhar.
 */
export async function inspectWebhookAction(): Promise<ActionResult<WebhookStatus>> {
  if (!(await requireMaster())) return { ok: false, error: "Só o time Autoprocs" };

  try {
    const subs = await getAppWebhookSubscriptions();
    const waba = subs.find((s) => s.object === "whatsapp_business_account");

    const admin = createAdminClient();
    const [entrada, entrega] = await Promise.all([
      admin
        .from("whatsapp_message")
        .select("created_at")
        .eq("direction", "in")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("dispatch_recipient")
        .select("delivered_at")
        .not("delivered_at", "is", null)
        .order("delivered_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const candidatos = [entrada.data?.created_at, entrega.data?.delivered_at].filter(
      (d): d is string => Boolean(d),
    );
    const ultimoEvento =
      candidatos.length > 0
        ? candidatos.sort((a, b) => (a < b ? 1 : -1))[0]!
        : null;

    return {
      ok: true,
      data: {
        callbackUrl: waba?.callback_url ?? null,
        esperado: await callbackUrl(),
        ativo: Boolean(waba?.active),
        campos: (waba?.fields ?? []).map((f) => f.name),
        ultimoEvento,
      },
    };
  } catch (e) {
    if (e instanceof GraphApiError) return { ok: false, error: `Meta: ${e.message}` };
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Reinscreve o app no webhook.
 *
 * A Meta só aceita depois de chamar a URL e receber o desafio de volta, então
 * sucesso aqui já significa que o caminho de volta voltou a existir.
 */
export async function repairWebhookAction(): Promise<ActionResult> {
  if (!(await requireMaster())) return { ok: false, error: "Só o time Autoprocs" };

  if (!serverEnv.META_VERIFY_TOKEN) {
    return { ok: false, error: "META_VERIFY_TOKEN não está configurado na Vercel" };
  }

  try {
    await subscribeAppWebhook({
      callbackUrl: await callbackUrl(),
      verifyToken: serverEnv.META_VERIFY_TOKEN,
      fields: WEBHOOK_FIELDS,
    });
    revalidatePath("/master/webhook");
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof GraphApiError) return { ok: false, error: `Meta: ${e.message}` };
    return { ok: false, error: (e as Error).message };
  }
}
