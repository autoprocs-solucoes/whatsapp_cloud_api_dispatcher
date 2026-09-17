import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildFunnel, countByStatus, formatInt, formatPct, rate } from "@/lib/metrics/funnel";
import { serverEnv } from "@/lib/env";
import { getWorkspaceOwnerIds, sendPushToUsers } from "@/server/push";

/**
 * Avisa os owners do workspace que um comunicado terminou.
 *
 * Chamado pelo worker (Edge Function) porque o envio de Web Push precisa de
 * Node, e o worker roda em Deno. Autenticado pela service_role key: é rota
 * interna, não tem sessão de usuário.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new NextResponse(null, { status: 401 });
  }

  let body: { dispatchId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.dispatchId) {
    return NextResponse.json({ error: "dispatchId ausente" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: dispatch } = await admin
    .from("dispatch")
    .select("id, workspace_id, status, total_recipients, template:template_id(name)")
    .eq("id", body.dispatchId)
    .maybeSingle();

  if (!dispatch) {
    return NextResponse.json({ error: "Comunicado não encontrado" }, { status: 404 });
  }

  const { data: rows } = await admin
    .from("dispatch_recipient")
    .select("status")
    .eq("dispatch_id", dispatch.id);

  const funnel = buildFunnel(countByStatus(rows ?? []), dispatch.total_recipients || 0);
  const tpl = dispatch.template as { name: string } | null;
  const name = tpl?.name ?? "Comunicado";

  // O resumo carrega o que importa decidir: quanto saiu e quanto falhou. Sem
  // isso a notificação obrigaria a abrir a plataforma só pra saber se deu certo.
  const title =
    dispatch.status === "failed"
      ? `${name}: disparo falhou`
      : `${name}: disparo concluído`;

  const parts = [
    `${formatInt(funnel.sent)} de ${formatInt(funnel.planned)} enviadas (${formatPct(rate(funnel.sent, funnel.planned))})`,
  ];
  if (funnel.failed > 0) parts.push(`${formatInt(funnel.failed)} falharam`);

  const owners = await getWorkspaceOwnerIds(dispatch.workspace_id);
  const sent = await sendPushToUsers(owners, {
    title,
    body: parts.join(" · "),
    url: `/comunicados/${dispatch.id}`,
    tag: `dispatch-${dispatch.id}`,
  });

  return NextResponse.json({ ok: true, notified: sent });
}
