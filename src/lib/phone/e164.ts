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

/**
 * Chave da conversa, sempre no mesmo formato.
 *
 * A Meta devolve o `wa_id` de números brasileiros antigos sem o nono dígito
 * (+556191255320), enquanto a gente envia para o número completo
 * (+5561991255320). São a mesma pessoa, mas viravam duas conversas: o template
 * numa, a resposta na outra.
 *
 * Canoniza para a forma com o 9 — a que os contatos usam e a que a pessoa
 * digita. Número que não é celular brasileiro passa direto.
 */
export function conversationKey(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";

  // 55 + DDD (2) + 8 dígitos = celular que perdeu o nono. Fixo começa com
  // 2 a 5, então só entram os que começam de 6 pra cima.
  if (digits.length === 12 && digits.startsWith("55") && /^[6-9]/.test(digits.slice(4))) {
    return `+${digits.slice(0, 4)}9${digits.slice(4)}`;
  }

  return `+${digits}`;
}
