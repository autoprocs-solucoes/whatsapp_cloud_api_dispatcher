import { CheckCircle2, TrendingDown } from "lucide-react";

import { biggestLoss, formatInt, formatPct, type Funnel } from "@/lib/metrics/funnel";
import { cn } from "@/lib/utils";

/** Texto de ação pra cada tipo de perda — o cliente não precisa saber o que a
 * API da Meta retornou pra entender o que fazer. */
const ADVICE: Record<string, string> = {
  failed: "Veja os erros agrupados abaixo pra saber a causa.",
  pending: "O envio ainda está rodando; os números sobem sozinhos.",
  undelivered: "Número inexistente, aparelho desligado ou sem internet.",
  unread: "Chegou no aparelho, mas a pessoa não abriu.",
};

/**
 * Responde "onde aconteceu a maior perda?" numa frase. É a única leitura da
 * tela que exigiria comparar etapas na mão.
 */
export function BiggestLossCard({ data, className }: { data: Funnel; className?: string }) {
  const loss = biggestLoss(data);

  if (!loss) {
    return (
      <div
        className={cn(
          "flex flex-col justify-center gap-2 rounded-lg border border-ok-line bg-ok-soft p-4",
          className,
        )}
      >
        <p className="label-caps flex items-center gap-1.5 text-ok-ink">
          <CheckCircle2 className="size-3.5" aria-hidden /> Sem perdas
        </p>
        <p className="text-xs text-ink-2">
          Todas as {formatInt(data.planned)} mensagens programadas chegaram e foram lidas.
        </p>
      </div>
    );
  }

  const critical = loss.key === "failed";

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-2 rounded-lg border p-4",
        critical ? "border-red-line bg-red-soft" : "border-line bg-card-2",
        className,
      )}
    >
      <p
        className={cn(
          "label-caps flex items-center gap-1.5",
          critical ? "text-red" : "text-ink-2",
        )}
      >
        <TrendingDown className="size-3.5" aria-hidden /> Maior perda
      </p>
      <div className="space-y-1">
        <p className={cn("num text-[22px] leading-none", critical && "text-red")}>
          {formatInt(loss.count)}
          <span className="text-[13px] text-ink-3"> · {formatPct(loss.ofPlanned)}</span>
        </p>
        <p className="text-xs leading-snug text-ink-2">{loss.label}</p>
      </div>
      <p className="text-[11px] leading-snug text-ink-3">{ADVICE[loss.key]}</p>
    </div>
  );
}
