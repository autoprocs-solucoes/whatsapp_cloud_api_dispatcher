/**
 * Fonte única da verdade das métricas de disparo.
 *
 * O banco guarda em `dispatch_recipient.status` apenas o estágio MAIS AVANÇADO
 * que cada destinatário atingiu — os status são mutuamente exclusivos. Quem leu
 * está em `read` e não aparece em `delivered`. Por isso todo número que o
 * cliente vê precisa ser acumulado antes de ir pra tela:
 *
 *   enviadas  = sent + delivered + read   (saíram e a Meta aceitou)
 *   entregues = delivered + read
 *   lidas     = read
 *   falharam  = failed
 *   pendentes = queued                    (ainda na fila)
 *
 * Invariante: enviadas + falharam + pendentes = programadas.
 *
 * Toda tela consome `buildFunnel`. Nenhum componente soma status na mão — foi
 * exatamente isso que fez a mesma palavra ("Enviado") significar 11 num card e
 * 244 no card ao lado.
 */

export type StatusCounts = {
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

export type Funnel = {
  /** Quantas mensagens foram programadas (destinatários do disparo). */
  planned: number;
  /** Saíram e a Meta aceitou — acumulado. */
  sent: number;
  /** Chegaram no aparelho — acumulado. */
  delivered: number;
  /** Foram abertas — acumulado. */
  read: number;
  /** Não saíram: a Meta recusou ou o envio deu erro. */
  failed: number;
  /** Ainda na fila, sem resposta da Meta. */
  pending: number;
  /** Destinatários que reagiram com emoji. */
  reactions: number;
  /** Saíram mas ainda sem confirmação de entrega. */
  undelivered: number;
  /** Chegaram mas ninguém abriu (ou a confirmação de leitura está desligada). */
  unread: number;
};

export const EMPTY_COUNTS: StatusCounts = {
  queued: 0,
  sent: 0,
  delivered: 0,
  read: 0,
  failed: 0,
};

/** Soma linhas de `dispatch_recipient` nos cinco baldes exclusivos. */
export function countByStatus(rows: { status: string }[]): StatusCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const r of rows) {
    if (r.status === "queued") counts.queued++;
    else if (r.status === "sent") counts.sent++;
    else if (r.status === "delivered") counts.delivered++;
    else if (r.status === "read") counts.read++;
    else if (r.status === "failed") counts.failed++;
  }
  return counts;
}

/**
 * Converte os baldes exclusivos no funil acumulado que o cliente lê.
 *
 * `planned` vem de `dispatch.total_recipients`. Quando não for informado, cai
 * pra soma dos status — que é o mesmo número, já que cada destinatário vira uma
 * linha no momento em que o comunicado é criado.
 */
export function buildFunnel(
  counts: StatusCounts,
  planned?: number,
  reactions = 0,
): Funnel {
  const sent = counts.sent + counts.delivered + counts.read;
  const delivered = counts.delivered + counts.read;
  const read = counts.read;
  const totalRows = sent + counts.failed + counts.queued;

  return {
    planned: planned && planned > 0 ? planned : totalRows,
    sent,
    delivered,
    read,
    failed: counts.failed,
    pending: counts.queued,
    reactions,
    undelivered: sent - delivered,
    unread: delivered - read,
  };
}

export function sumFunnels(items: Funnel[]): Funnel {
  return items.reduce<Funnel>(
    (acc, f) => ({
      planned: acc.planned + f.planned,
      sent: acc.sent + f.sent,
      delivered: acc.delivered + f.delivered,
      read: acc.read + f.read,
      failed: acc.failed + f.failed,
      pending: acc.pending + f.pending,
      reactions: acc.reactions + f.reactions,
      undelivered: acc.undelivered + f.undelivered,
      unread: acc.unread + f.unread,
    }),
    {
      planned: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      pending: 0,
      reactions: 0,
      undelivered: 0,
      unread: 0,
    },
  );
}

/** Razão em %, ou `null` quando não há base — nunca inventa 0%. */
export function rate(value: number, base: number): number | null {
  if (base <= 0) return null;
  return (value / base) * 100;
}

/** "95,5%" — uma casa decimal só quando ela muda a leitura. */
export function formatPct(value: number | null): string {
  if (value === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1).replace(".", ",")}%`;
}

export function formatInt(value: number): string {
  return value.toLocaleString("pt-BR");
}

export type Loss = {
  key: "failed" | "pending" | "undelivered" | "unread";
  /** Frase pronta, em linguagem de negócio. */
  label: string;
  count: number;
  /** % sobre o total programado. */
  ofPlanned: number | null;
};

/**
 * Onde cada mensagem se perdeu, da maior perda pra menor. Responde "onde
 * aconteceu a maior perda?" sem o cliente precisar comparar etapas na mão.
 */
export function losses(f: Funnel): Loss[] {
  const all: Loss[] = [
    {
      key: "failed",
      label: "não saíram (falha no envio)",
      count: f.failed,
      ofPlanned: rate(f.failed, f.planned),
    },
    {
      key: "pending",
      label: "ainda na fila",
      count: f.pending,
      ofPlanned: rate(f.pending, f.planned),
    },
    {
      key: "undelivered",
      label: "saíram mas não confirmaram entrega",
      count: f.undelivered,
      ofPlanned: rate(f.undelivered, f.planned),
    },
    {
      key: "unread",
      label: "chegaram mas não foram abertas",
      count: f.unread,
      ofPlanned: rate(f.unread, f.planned),
    },
  ];
  return all.filter((l) => l.count > 0).sort((a, b) => b.count - a.count);
}

/** A maior perda isolada, pro destaque da tela. */
export function biggestLoss(f: Funnel): Loss | null {
  return losses(f)[0] ?? null;
}
