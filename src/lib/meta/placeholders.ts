/**
 * Extrai placeholders de um texto WhatsApp. Suporta:
 *  - Positional: `{{1}}`, `{{2}}` → retorna `["1", "2"]`
 *  - Named: `{{nome}}`, `{{moto_clube}}` → retorna `["nome", "moto_clube"]`
 *
 * Meta exige que um template use apenas um dos dois modos, mas a função
 * aceita ambos e devolve a lista única na ordem de primeira ocorrência
 * (positional ainda ordenado por número, named pela ordem que aparece).
 */
export function extractPlaceholders(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\{\{\s*([a-zA-Z_]\w*|\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1]!;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  // Se todos numéricos, ordena por valor pra preservar contrato antigo.
  if (out.every((p) => /^\d+$/.test(p))) {
    out.sort((a, b) => Number(a) - Number(b));
  }
  return out;
}

/** True se o placeholder é nomeado (`nome`), false se posicional (`1`). */
export function isNamedPlaceholder(p: string): boolean {
  return !/^\d+$/.test(p);
}
