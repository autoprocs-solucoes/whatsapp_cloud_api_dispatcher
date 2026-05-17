/**
 * Converte texto para slug minúsculo, sem acentos, com hífens.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Slug + sufixo curto aleatório (evita colisão).
 */
export function slugifyWithSuffix(input: string): string {
  const base = slugify(input) || "workspace";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
