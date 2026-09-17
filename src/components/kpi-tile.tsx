import Link from "next/link";
import type { Route } from "next";

import { cn } from "@/lib/utils";

export type KpiDelta = {
  /** Variação em pontos percentuais ou %, já calculada pela fonte de dados. */
  pct: number;
  /** Texto de referência, ex.: "vs. período anterior". */
  label: string;
};

type Props = {
  label: string;
  /** `null` vira travessão — nunca zero inventado. */
  value: number | string | null;
  suffix?: string;
  caption?: React.ReactNode;
  delta?: KpiDelta;
  tone?: "default" | "muted" | "danger";
  href?: string;
  className?: string;
};

/** Indicador: rótulo em caixa-alta, número preto grande, linha de contexto. */
export function KpiTile({
  label,
  value,
  suffix,
  caption,
  delta,
  tone = "default",
  href,
  className,
}: Props) {
  const body = (
    <>
      <p className="label-caps">{label}</p>
      <p
        className={cn(
          "num mt-1.5 text-[28px] leading-none",
          tone === "danger" && "text-red",
        )}
      >
        {value === null ? "" : value}
        {value !== null && suffix ? (
          <span className="text-[20px] text-ink-2">{suffix}</span>
        ) : null}
      </p>
      {(delta || caption) && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
          {delta && (
            <span
              className={cn("font-semibold", delta.pct >= 0 ? "text-brand" : "text-red")}
            >
              {delta.pct >= 0 ? "▲" : "▼"} {Math.abs(delta.pct)}%
            </span>
          )}
          {delta && <span>{delta.label}</span>}
          {caption}
        </p>
      )}
    </>
  );

  const classes = cn(
    "block rounded-lg border border-line p-4 shadow-card",
    tone === "muted" ? "bg-card-2" : "bg-card",
    tone === "danger" && "border-red-line bg-red-soft",
    href && "transition-colors hover:border-line-3 hover:bg-card-2",
    className,
  );

  if (href) {
    return (
      <Link href={href as Route} className={classes}>
        {body}
      </Link>
    );
  }
  return <div className={classes}>{body}</div>;
}
