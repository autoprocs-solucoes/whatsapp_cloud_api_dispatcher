import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  getAppWebhookSubscriptions,
  GraphApiError,
  subscribeAppWebhook,
} from "@/lib/meta/graph-api";
import { env, serverEnv } from "@/lib/env";

/**
 * Diagnostica e reinscreve o webhook do app na Meta.
 *
 * Mesma coisa que o botão do painel master faz, mas chamável sem sessão de
 * usuário — porque quando o webhook cai, quem precisa agir nem sempre é quem
 * está logado, e a correção não pode depender de alguém estar na frente da
 * tela.
 *
 * Autenticada pela service_role, como as outras rotas internas.
 */
const WEBHOOK_FIELDS = ["messages"];

function callbackUrl(req: NextRequest): string {
  // O host de quem chegou, não o da variável de ambiente: foi uma variável
  // apontando pra um túnel de desenvolvimento que derrubou tudo.
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = host ? `${proto}://${host}` : env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${base}/api/webhooks/meta`;
}

function autorizado(req: NextRequest): boolean {
  const esperado = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(esperado) && req.headers.get("authorization") === `Bearer ${esperado}`;
}

async function estado(req: NextRequest) {
  const subs = await getAppWebhookSubscriptions();
  const waba = subs.find((s) => s.object === "whatsapp_business_account");
  return {
    callbackUrl: waba?.callback_url ?? null,
    esperado: callbackUrl(req),
    ativo: Boolean(waba?.active),
    campos: (waba?.fields ?? []).map((f) => f.name),
  };
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return new NextResponse(null, { status: 401 });
  try {
    return NextResponse.json({ ok: true, antes: await estado(req) });
  } catch (e) {
    const msg = e instanceof GraphApiError ? e.message : (e as Error).message;
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return new NextResponse(null, { status: 401 });

  if (!serverEnv.META_VERIFY_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "META_VERIFY_TOKEN ausente" },
      { status: 500 },
    );
  }

  try {
    const antes = await estado(req);

    // `?auto=1` é o modo vigia, chamado de hora em hora: só age quando a
    // inscrição realmente caiu. Reinscrever à toa toda hora seria barulho na
    // Meta e esconderia o problema em vez de mostrá-lo.
    const auto = new URL(req.url).searchParams.get("auto") === "1";
    const saudavel =
      antes.callbackUrl === antes.esperado &&
      antes.ativo &&
      antes.campos.includes("messages");
    if (auto && saudavel) {
      return NextResponse.json({ ok: true, acao: "nada a fazer", antes });
    }

    await subscribeAppWebhook({
      callbackUrl: callbackUrl(req),
      verifyToken: serverEnv.META_VERIFY_TOKEN,
      fields: WEBHOOK_FIELDS,
    });
    console.warn("[webhook] inscricao do app refeita", JSON.stringify(antes));
    const depois = await estado(req);
    return NextResponse.json({ ok: true, acao: "reinscrito", antes, depois });
  } catch (e) {
    const msg = e instanceof GraphApiError ? e.message : (e as Error).message;
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
