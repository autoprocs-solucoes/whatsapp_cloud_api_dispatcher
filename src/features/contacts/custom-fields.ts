// Normaliza contact.custom_fields. Coluna jsonb no DB, mas em algumas situações
// (import legado, payload com double-encode) pode chegar como string JSON.
// Sempre validar antes de usar.

export function parseCustomFields(value: unknown): Record<string, string> {
  if (value == null) return {};

  let raw: unknown = value;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return {};
    }
  }

  if (typeof raw !== "object" || Array.isArray(raw)) return {};

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null) continue;
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}

// Item da fila de solicitações externas (IA) p/ alterar custom_fields.
// Persistido em tabela própria: public.contact_pending_update.
export type PendingUpdateItem = {
  id: string;
  field: string;
  value: string;
  source: string | null;
  created_at: string;
};
