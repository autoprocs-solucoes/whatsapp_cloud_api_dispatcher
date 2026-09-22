/**
 * Data e hora no fuso do Brasil, sempre.
 *
 * O servidor da Vercel roda em UTC, então tela renderizada no servidor mostrava
 * 19:25 numa mensagem enviada às 16:25. Fixar o fuso aqui resolve nos dois
 * lados: no servidor, porque ele não tem fuso próprio pra herdar; no navegador,
 * porque o resultado passa a ser o mesmo do servidor e a hidratação não briga.
 *
 * Fuso fixo e não o do navegador de propósito: a operação é brasileira, e
 * quem abre o painel viajando precisa ver a mesma hora que o time inteiro vê.
 */

const TIME_ZONE = "America/Sao_Paulo";
const LOCALE = "pt-BR";

export function formatTimeBR(value: string | Date): string {
  return new Date(value).toLocaleTimeString(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateBR(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" },
): string {
  return new Date(value).toLocaleDateString(LOCALE, { timeZone: TIME_ZONE, ...options });
}

export function formatDateTimeBR(value: string | Date): string {
  return new Date(value).toLocaleString(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Dia do calendário no fuso do Brasil — pra comparar "é o mesmo dia?". */
export function dayKeyBR(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}
