import { parsePhoneNumberFromString } from "libphonenumber-js";

export type NormalizeResult =
  | { ok: true; e164: string }
  | { ok: false; reason: string };

const DEFAULT_COUNTRY = "BR" as const;

export function normalizeBR(rawInput: string | number | null | undefined): NormalizeResult {
  if (rawInput === null || rawInput === undefined) {
    return { ok: false, reason: "vazio" };
  }

  const raw = String(rawInput).trim();
  if (raw.length === 0) {
    return { ok: false, reason: "vazio" };
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) {
    return { ok: false, reason: "sem dígitos" };
  }

  const candidate = raw.startsWith("+") ? raw : digits;

  const parsed = parsePhoneNumberFromString(candidate, DEFAULT_COUNTRY);
  if (!parsed) {
    return { ok: false, reason: "formato inválido" };
  }

  if (!parsed.isValid()) {
    return { ok: false, reason: "número não passa validação E.164" };
  }

  return { ok: true, e164: parsed.number };
}
