import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/server/workspace";
import type { Contact } from "@/lib/supabase/database.types";

const BASE_COLUMNS = [
  "phone_e164",
  "full_name",
  "opt_out",
  "opt_out_at",
  "tags",
  "created_at",
  "updated_at",
] as const;

const BATCH = 1000;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatBase(contact: Contact, key: (typeof BASE_COLUMNS)[number]): unknown {
  const v = contact[key];
  if (key === "tags" && Array.isArray(v)) return v.join("; ");
  return v;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });

  const workspace = await requireActiveWorkspace();
  const admin = createAdminClient();

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const optOutFilter = url.searchParams.get("optOutFilter") ?? "all";

  const all: Contact[] = [];
  for (let from = 0; ; from += BATCH) {
    let query = admin
      .from("contact")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .range(from, from + BATCH - 1);

    if (optOutFilter === "active") query = query.eq("opt_out", false);
    if (optOutFilter === "opt_out") query = query.eq("opt_out", true);
    if (search) {
      const s = search.replace(/[%_]/g, "\\$&");
      query = query.or(`full_name.ilike.%${s}%,phone_e164.ilike.%${s}%`);
    }

    const { data, error } = await query;
    if (error) return new NextResponse(error.message, { status: 500 });
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < BATCH) break;
  }

  // Descobre dinamicamente todas chaves de custom_fields.
  const customKeySet = new Set<string>();
  for (const c of all) {
    const cf = (c.custom_fields ?? {}) as Record<string, unknown>;
    Object.keys(cf).forEach((k) => customKeySet.add(k));
  }
  const customKeys = Array.from(customKeySet).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  const header = [...BASE_COLUMNS, ...customKeys].join(",");
  const rows = all.map((c) => {
    const base = BASE_COLUMNS.map((k) => csvEscape(formatBase(c, k)));
    const cf = (c.custom_fields ?? {}) as Record<string, unknown>;
    const custom = customKeys.map((k) => csvEscape(cf[k]));
    return [...base, ...custom].join(",");
  });
  // BOM UTF-8 pra Excel abrir acentos certo.
  const body = "﻿" + [header, ...rows].join("\n");

  const filename = `contatos-${workspace.slug ?? workspace.id.slice(0, 8)}-${new Date()
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
