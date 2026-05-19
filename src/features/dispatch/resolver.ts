import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeBR } from "@/lib/phone/e164";
import { applyRules } from "@/features/segments/rules";
import { rulesSchema, type Rules } from "@/features/segments/schemas";
import type { Contact } from "@/lib/supabase/database.types";
import type { VariableColumn, VariableMapping } from "./schemas";

export type ResolvedRecipient = {
  contact_id: string | null;
  phone_e164: string;
  full_name: string | null;
  custom_fields: Record<string, string>;
};

export type ResolveStats = {
  resolved: number;
  filtered_opt_out: number;
  invalid_phones: number;
  unknown_phones: number;
};

type ResolveResult = {
  recipients: ResolvedRecipient[];
  stats: ResolveStats;
};

function contactToRecipient(c: Contact): ResolvedRecipient {
  return {
    contact_id: c.id,
    phone_e164: c.phone_e164,
    full_name: c.full_name,
    custom_fields: (c.custom_fields ?? {}) as Record<string, string>,
  };
}

/**
 * Resolve destinatários a partir de um segmento. Sempre filtra opt_out=false.
 */
export async function resolveFromSegment(
  workspaceId: string,
  segmentId: string,
): Promise<ResolveResult> {
  const admin = createAdminClient();

  const { data: segment } = await admin
    .from("segment")
    .select("rules")
    .eq("workspace_id", workspaceId)
    .eq("id", segmentId)
    .maybeSingle();

  if (!segment) {
    return { recipients: [], stats: { resolved: 0, filtered_opt_out: 0, invalid_phones: 0, unknown_phones: 0 } };
  }

  let parsedRules: Rules;
  try {
    parsedRules = rulesSchema.parse(segment.rules);
  } catch {
    parsedRules = { match: "and", rules: [] };
  }

  const base = admin
    .from("contact")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  const query = applyRules(base, parsedRules);
  const { data } = await query;

  const recipients = (data ?? []).map(contactToRecipient);
  return {
    recipients,
    stats: {
      resolved: recipients.length,
      filtered_opt_out: 0,
      invalid_phones: 0,
      unknown_phones: 0,
    },
  };
}

/**
 * Resolve a partir de uma lista manual de telefones (uma string por entrada).
 * - Normaliza E.164 BR (default).
 * - Dedup.
 * - Para cada normalizado, busca contato. Se existir e opt_out=true → pula.
 * - Se não existir → cria recipient sintético com contact_id=null.
 */
export async function resolveFromManual(
  workspaceId: string,
  rawPhones: string[],
): Promise<ResolveResult> {
  const stats: ResolveStats = {
    resolved: 0,
    filtered_opt_out: 0,
    invalid_phones: 0,
    unknown_phones: 0,
  };

  const normalized = new Set<string>();
  for (const raw of rawPhones) {
    const r = normalizeBR(raw);
    if (!r.ok) {
      stats.invalid_phones++;
      continue;
    }
    normalized.add(r.e164);
  }

  if (normalized.size === 0) return { recipients: [], stats };

  const admin = createAdminClient();
  const { data: contacts } = await admin
    .from("contact")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("phone_e164", Array.from(normalized));

  const byPhone = new Map<string, Contact>();
  (contacts ?? []).forEach((c) => byPhone.set(c.phone_e164, c));

  const out: ResolvedRecipient[] = [];
  for (const phone of normalized) {
    const c = byPhone.get(phone);
    if (c) {
      if (c.opt_out) {
        stats.filtered_opt_out++;
        continue;
      }
      out.push(contactToRecipient(c));
    } else {
      stats.unknown_phones++;
      out.push({
        contact_id: null,
        phone_e164: phone,
        full_name: null,
        custom_fields: {},
      });
    }
  }

  stats.resolved = out.length;
  return { recipients: out, stats };
}

// ----------------------------------------------------------------------------
// Resolve valor de uma coluna em um recipient.
// ----------------------------------------------------------------------------
function resolveColumn(r: ResolvedRecipient, col: VariableColumn): string {
  if (col.kind === "attr") {
    if (col.name === "full_name") return r.full_name ?? "";
    if (col.name === "phone_e164") return r.phone_e164;
  }
  if (col.kind === "custom") {
    const v = r.custom_fields[col.key];
    return typeof v === "string" ? v : "";
  }
  return "";
}

/**
 * Resolve mapping → dict de valores indexados por chave ("header:1", "body:1", ...).
 */
export function resolveVariables(
  recipient: ResolvedRecipient,
  mapping: VariableMapping,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(mapping)) {
    const raw = resolveColumn(recipient, entry.column).trim();
    out[key] = raw || entry.fallback || "";
  }
  return out;
}
