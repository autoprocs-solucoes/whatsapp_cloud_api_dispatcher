import { cn } from "@/lib/utils";
import { formatInt, formatPct, rate } from "@/lib/metrics/funnel";

export type StageTone = "neutral" | "brand" | "ok" | "danger" | "pending" | "violet";

const TONE: Record<StageTone, { value: string; pill: string; bar: string }> = {
  neutral: { value: "text-ink", pill: "border-line-2 bg-card-2 text-ink-2", bar: "bg-ink-4" },
  brand: {
    value: "text-ink",
    pill: "border-brand-line bg-brand-soft text-brand-strong",
    bar: "bg-brand",
  },
  ok: { value: "text-ink", pill: "border-ok-line bg-ok-soft text-ok-ink", bar: "bg-ok" },
  danger: { value: "text-red", pill: "border-red-line bg-red-soft text-red", bar: "bg-red" },
  pending: {
    value: "text-ink",
    pill: "border-amber-line bg-amber-soft text-amber",
    bar: "bg-amber",
  },
  violet: {
    value: "text-ink",
    pill: "border-violet-line bg-violet-soft text-violet",
    bar: "bg-violet",
  },
};

type Props = {
  /** Rótulo em caixa-alta: ENVIADAS, ENTREGUES… */
  label: string;
  /** Numerador — o que aconteceu. */
  value: number;
  /** Denominador — a base de comparação. Omitir quando a etapa é a própria base. */
  base?: number;
  /** Como a base se chama: "do programado", "das enviadas"… */
  baseLabel?: string;
  /** Segunda leitura, normalmente o % sobre o total programado. */
  secondary?: string;
  tone?: StageTone;
  /** Ícone de ajuda ao lado do rótulo. */
  hint?: React.ReactNode;
  className?: string;
};

/**
 * Card de etapa do funil. A hierarquia é fixa e igual em toda a plataforma:
 *
 *   ENVIADAS          ← o que é
 *   244 / 400         ← o que aconteceu, sobre a base (destaque)
 *   61% do programado ← a conta já feita
 *
 * O cliente nunca precisa dividir nada: o numerador, o denominador e a
 * porcentagem estão os três na tela.
 */
export function StageCard({
  label,
  value,
  base,
  baseLabel,
  secondary,
  tone = "neutral",
  hint,
  className,
}: Props) {
  const t = TONE[tone];
  const pct = base !== undefined ? rate(value, base) : null;
  const barWidth = pct === null ? 100 : Math.max(0, Math.min(100, pct));

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-lg border border-line bg-card p-4 shadow-card",
        className,
      )}
    >
      <div className="space-y-2">
        <p className="label-caps flex items-center gap-1">
          {label}
          {hint}
        </p>
        <p className={cn("num text-[26px] leading-none", t.value)}>
          {formatInt(value)}
          {base !== undefined && (
            <span className="text-[17px] text-ink-3"> / {formatInt(base)}</span>
          )}
        </p>
      </div>

      <div className="space-y-2">
        {/* Barra fina: a mesma proporção do número, pra leitura em um relance. */}
        <div className="h-1 overflow-hidden rounded-full bg-card-2" aria-hidden>
          <div className={cn("h-full rounded-full", t.bar)} style={{ width: `${barWidth}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {pct !== null && (
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 py-px text-[11px] font-semibold",
                t.pill,
              )}
            >
              {formatPct(pct)}
            </span>
          )}
          {baseLabel && <span className="text-[11px] text-ink-2">{baseLabel}</span>}
          {secondary && <span className="text-[11px] text-ink-3">· {secondary}</span>}
        </div>
      </div>
    </div>
  );
}
