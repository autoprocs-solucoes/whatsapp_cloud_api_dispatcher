import { CheckCheck, CornerDownRight, Eye, Send, Smile, Users2 } from "lucide-react";

import { ReadRateInfo } from "@/features/dashboard/read-rate-info";
import { formatInt, formatPct, rate, type Funnel } from "@/lib/metrics/funnel";
import { cn } from "@/lib/utils";

type Props = {
  data: Funnel;
  emptyMessage?: string;
};

type Step = {
  key: string;
  label: string;
  value: number;
  icon: typeof Users2;
  color: string;
  /** Conversão em relação à etapa anterior. */
  fromPrev: { pct: number | null; label: string } | null;
  /** O que se perdeu entre a etapa anterior e esta. */
  loss: { count: number; label: string; tone: "red" | "ink" } | null;
  hint?: React.ReactNode;
};

/**
 * Funil de entrega: mostra a jornada da mensagem e, entre cada par de etapas,
 * quanto se perdeu no caminho. A largura da barra é sempre proporcional ao
 * total programado, então a forma do funil já responde "onde eu perco mais".
 */
export function DeliveryFunnel({ data, emptyMessage }: Props) {
  if (data.planned === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-xs text-ink-3">
        {emptyMessage ?? "Sem disparos no período."}
      </div>
    );
  }

  const notSent = data.failed + data.pending;

  const steps: Step[] = [
    {
      key: "planned",
      label: "Programadas",
      value: data.planned,
      icon: Users2,
      color: "var(--line-3)",
      fromPrev: null,
      loss: null,
    },
    {
      key: "sent",
      label: "Enviadas",
      value: data.sent,
      icon: Send,
      color: "var(--d-deliv)",
      fromPrev: { pct: rate(data.sent, data.planned), label: "do programado" },
      loss:
        notSent > 0
          ? {
              count: notSent,
              label:
                data.failed > 0 && data.pending > 0
                  ? `não saíram (${formatInt(data.failed)} falharam, ${formatInt(data.pending)} na fila)`
                  : data.failed > 0
                    ? "não saíram: falha no envio"
                    : "ainda na fila",
              tone: data.failed > 0 ? "red" : "ink",
            }
          : null,
    },
    {
      key: "delivered",
      label: "Entregues",
      value: data.delivered,
      icon: CheckCheck,
      color: "var(--brand-2)",
      fromPrev: { pct: rate(data.delivered, data.sent), label: "das enviadas" },
      loss:
        data.undelivered > 0
          ? {
              count: data.undelivered,
              label: "saíram mas não confirmaram entrega",
              tone: "ink",
            }
          : null,
    },
    {
      key: "read",
      label: "Lidas",
      value: data.read,
      icon: Eye,
      color: "var(--brand)",
      fromPrev: { pct: rate(data.read, data.delivered), label: "das entregues" },
      loss:
        data.unread > 0
          ? { count: data.unread, label: "chegaram mas não foram abertas", tone: "ink" }
          : null,
      hint: <ReadRateInfo />,
    },
  ];

  if (data.reactions > 0) {
    steps.push({
      key: "reactions",
      label: "Reações",
      value: data.reactions,
      icon: Smile,
      color: "var(--violet)",
      fromPrev: { pct: rate(data.reactions, data.read), label: "das lidas" },
      loss: null,
    });
  }

  return (
    <div className="space-y-1">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const width = Math.max(0, Math.min(100, rate(s.value, data.planned) ?? 0));
        return (
          <div key={s.key}>
            {/* Conector: o que sumiu entre a etapa de cima e esta. */}
            {s.loss && (
              <p
                className={cn(
                  "flex items-center gap-1 py-1 pl-1 text-[11px]",
                  s.loss.tone === "red" ? "text-red" : "text-ink-3",
                )}
              >
                <CornerDownRight className="size-3 shrink-0" aria-hidden />
                <span className="font-semibold">−{formatInt(s.loss.count)}</span>
                <span className={s.loss.tone === "red" ? "text-ink-2" : undefined}>
                  {s.loss.label}
                </span>
              </p>
            )}

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-ink-2">
                  <Icon className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                  {s.label}
                  {s.hint}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  {s.fromPrev && (
                    <span className="text-[11px] whitespace-nowrap text-ink-3">
                      {formatPct(s.fromPrev.pct)} {s.fromPrev.label}
                    </span>
                  )}
                  <span className="num text-[15px]">{formatInt(s.value)}</span>
                </span>
              </div>
              <div
                className={cn("overflow-hidden rounded-full bg-card-2", i === 0 ? "h-2.5" : "h-2")}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${width}%`, background: s.color }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
