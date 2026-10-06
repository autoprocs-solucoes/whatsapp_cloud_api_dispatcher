import "server-only";

import { headers } from "next/headers";

import { env } from "@/lib/env";

/**
 * O endereço público por onde esta requisição realmente chegou.
 *
 * Confiar na variável de ambiente já custou caro: `NEXT_PUBLIC_APP_URL` ficou
 * apontando pra um túnel ngrok de desenvolvimento dentro da produção. Quando o
 * túnel morreu, a Meta tentou entregar os webhooks ali, falhou, e desativou a
 * inscrição do app — quatro dias sem receber confirmação de entrega nem
 * resposta de cliente, de nenhum cliente, sem nada na tela indicando isso.
 *
 * O cabeçalho do pedido não tem como estar desatualizado: ele descreve o
 * caminho que acabou de funcionar.
 */
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}
