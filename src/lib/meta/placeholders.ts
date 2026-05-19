/**
 * Extrai placeholders {{N}} de um texto. Retorna lista ordenada e única.
 * Ex: "Olá {{1}}, seu código {{2}}" → ["1", "2"]
 */
export function extractPlaceholders(text: string | null | undefined): string[] {
  if (!text) return [];
  const set = new Set<string>();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    set.add(m[1]!);
  }
  return Array.from(set).sort((a, b) => Number(a) - Number(b));
}
