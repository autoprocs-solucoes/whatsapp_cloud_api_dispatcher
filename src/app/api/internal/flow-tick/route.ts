import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { serverEnv } from "@/lib/env";
import { resumeDueFlowRuns } from "@/server/flow-engine";

/**
 * Retoma os fluxos parados em bloco de atraso cuja hora chegou.
 *
 * Roda por cron (pg_cron chamando esta rota, igual ao worker de transmissão) —
 * o motor precisa de Node, então não dá pra viver dentro da Edge Function em
 * Deno. Autenticado pela service_role key: rota interna, sem sessão.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new NextResponse(null, { status: 401 });
  }

  const resumed = await resumeDueFlowRuns();
  return NextResponse.json({ resumed });
}
