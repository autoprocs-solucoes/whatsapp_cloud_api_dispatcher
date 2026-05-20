import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/server/workspace";

const COLUMNS = [
  "phone_e164",
  "status",
  "meta_message_id",
  "sent_at",
  "delivered_at",
  "read_at",
  "failed_at",
  "reaction_emoji",
  "reaction_at",
  "error_code",
  "error_message",
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();

  const { data: dispatch } = await admin
    .from("dispatch")
    .select("id, template_id, created_at")
    .eq("workspace_id", workspace.id)
    .eq("id", id)
    .maybeSingle();
  if (!dispatch) return new NextResponse("Não encontrado", { status: 404 });

  const { data: recipients } = await admin
    .from("dispatch_recipient")
    .select("*")
    .eq("dispatch_id", id)
    .order("phone_e164", { ascending: true });

  const header = COLUMNS.join(",");
  const rows = (recipients ?? []).map((r) =>
    COLUMNS.map((c) => csvEscape((r as Record<string, unknown>)[c])).join(","),
  );
  const body = "﻿" + [header, ...rows].join("\n");

  const filename = `comunicado-${id.slice(0, 8)}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
