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

/**
 * Templates com HEADER format IMAGE não têm placeholder de texto — o
 * header_text fica null. Precisam de um parâmetro de imagem em toda mensagem
 * (mesmo sem variação por contato). Reaproveita o link do exemplo aprovado
 * pela Meta (components_raw[].example.header_handle), já hospedado no CDN
 * da própria Meta.
 */
export function extractHeaderImageLink(componentsRaw: unknown): string | null {
  if (!Array.isArray(componentsRaw)) return null;
  for (const c of componentsRaw) {
    if (
      c &&
      typeof c === "object" &&
      (c as Record<string, unknown>).type === "HEADER" &&
      (c as Record<string, unknown>).format === "IMAGE"
    ) {
      const example = (c as Record<string, unknown>).example as
        | { header_handle?: unknown }
        | undefined;
      const handle = example?.header_handle;
      if (Array.isArray(handle) && typeof handle[0] === "string") {
        return handle[0];
      }
    }
  }
  return null;
}
