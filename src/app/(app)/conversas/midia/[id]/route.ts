import "server-only";

import { NextResponse } from "next/server";

import { downloadMedia, getMediaUrl } from "@/lib/meta/graph-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveWorkspace } from "@/server/workspace";

/**
 * Serve um arquivo recebido pelo WhatsApp.
 *
 * Precisa passar pelo servidor: a URL que a Meta devolve exige o access token
 * no header e expira em poucos minutos, então não dá pra apontar a tag <img>
 * direto pra ela — e o token não pode ir pro navegador.
 *
 * O media_id é conferido contra o workspace ativo antes de qualquer chamada:
 * sem isso, qualquer pessoa logada baixaria a mídia de outro cliente só
 * adivinhando o id.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();

  const admin = createAdminClient();
  const { data: message } = await admin
    .from("whatsapp_message")
    .select("media_id, media_mime, connection_id")
    .eq("workspace_id", workspace.id)
    .eq("media_id", id)
    .limit(1)
    .maybeSingle();

  if (!message) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: connection } = await admin
    .from("workspace_meta_connection")
    .select("access_token")
    .eq("id", message.connection_id)
    .maybeSingle();

  if (!connection?.access_token) {
    return new NextResponse("Sem conexão", { status: 502 });
  }

  try {
    const { url } = await getMediaUrl(id, connection.access_token);
    const { body, contentType } = await downloadMedia(url, connection.access_token);
    return new NextResponse(body, {
      headers: {
        "Content-Type": message.media_mime ?? contentType,
        // Privado: é conteúdo de um workspace específico.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[conversas/midia]", (e as Error).message);
    return new NextResponse("Falha ao carregar mídia", { status: 502 });
  }
}
