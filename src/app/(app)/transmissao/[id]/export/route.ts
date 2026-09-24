import { NextResponse } from "next/server";

import { parseCustomFields } from "@/features/contacts/custom-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/server/workspace";

const COLUMNS = [
  "phone_e164",
  "full_name",
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

const STATUSES = ["queued", "sent", "delivered", "read", "failed"] as const;
type RecipientStatus = (typeof STATUSES)[number];

/** Rótulo curto pro nome do arquivo — quem baixa três CSVs precisa saber qual
 * é qual sem abrir. */
const STATUS_SLUG: Record<RecipientStatus, string> = {
  queued: "na-fila",
  sent: "enviadas",
  delivered: "entregues",
  read: "lidas",
  failed: "falharam",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Os mesmos recortes da tela: o que está filtrado é o que sai no arquivo.
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = STATUSES.find((s) => s === statusParam) ?? null;
  const errorCode = url.searchParams.get("error")?.trim() || null;

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

  // O CSV é o que o cliente leva pro time de vendas: se parar em 1000 linhas
  // sem avisar, some gente da lista e ninguém percebe.
  const recipients = await fetchAllRows<Record<string, unknown>>((from, to) => {
    let query = admin
      .from("dispatch_recipient")
      // O contato vem junto porque o CSV de falhas vira lista de retrabalho:
      // quem vai reenviar precisa do nome, das etiquetas e das variáveis que
      // alimentam o modelo — sem elas, é preciso cruzar com a planilha antiga
      // na mão pra recuperar coisas como o motoclube de cada pessoa.
      .select("*, contact:contact_id(full_name, tags, custom_fields)")
      .eq("dispatch_id", id);

    if (status) query = query.eq("status", status);
    // "sem código" é um grupo de verdade na tela de erros: a Meta nem sempre
    // devolve um código.
    if (errorCode) {
      query = errorCode === "none" ? query.is("error_code", null) : query.eq("error_code", errorCode);
    }

    return query
      .order("phone_e164", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
  });

  type ContactSide = {
    full_name?: string | null;
    tags?: string[] | null;
    custom_fields?: unknown;
  };

  // Uma coluna por variável que existir nesta lista. Cada cliente tem as suas
  // ("motoclube", "cidade", "plano"), então a planilha se monta a partir dos
  // dados em vez de ter colunas fixas que não servem pra ninguém.
  const flattened = recipients.map((r) => {
    const contact = r.contact as ContactSide | null;
    const custom = parseCustomFields(contact?.custom_fields);
    return {
      ...r,
      full_name: contact?.full_name ?? "",
      tags: (contact?.tags ?? []).join("; "),
      custom,
    };
  });

  const customColumns = Array.from(
    new Set(flattened.flatMap((r) => Object.keys(r.custom))),
  )
    // O importador guarda o telefone e o nome também como variável; repetir a
    // mesma informação em duas colunas só atrapalha quem abre a planilha.
    .filter((key) => !COLUMNS.includes(key as (typeof COLUMNS)[number]))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const allColumns = [...COLUMNS, "tags", ...customColumns];

  const header = allColumns.join(",");
  const rows = flattened.map((r) => {
    // A base vem por último: o nome do contato vale mais que a cópia dele
    // que o importador guardou como variável.
    const flat: Record<string, unknown> = { ...r.custom, ...r };
    return allColumns.map((c) => csvEscape(flat[c])).join(",");
  });
  const body = "﻿" + [header, ...rows].join("\n");

  const parts = [
    "transmissao",
    id.slice(0, 8),
    status ? STATUS_SLUG[status] : null,
    errorCode && errorCode !== "none" ? `erro-${errorCode}` : null,
    new Date().toISOString().slice(0, 10),
  ].filter(Boolean);
  const filename = `${parts.join("-")}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
