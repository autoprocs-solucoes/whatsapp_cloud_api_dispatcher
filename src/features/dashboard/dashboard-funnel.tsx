import { CheckCircle2, Eye, Send, Users2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FunnelStats } from "@/features/dashboard/queries";
import { ReadRateInfo } from "@/features/dashboard/read-rate-info";

type Props = { data: FunnelStats };

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.max(0, Math.min(100, (n / d) * 100));
}

export function DashboardFunnel({ data }: Props) {
  const total = Math.max(data.total, 1);
  const steps = [
    {
      key: "total",
      label: "Destinatários",
      value: data.total,
      icon: Users2,
      color: "bg-slate-400 dark:bg-slate-500",
      width: 100,
      conversionFromPrev: null as number | null,
    },
    {
      key: "sent",
      label: "Enviado",
      value: data.sent,
      icon: Send,
      color: "bg-sky-400 dark:bg-sky-500",
      width: pct(data.sent, total),
      conversionFromPrev: data.total > 0 ? pct(data.sent, data.total) : null,
    },
    {
      key: "delivered",
      label: "Entregue",
      value: data.delivered,
      icon: CheckCircle2,
      color: "bg-blue-500 dark:bg-blue-600",
      width: pct(data.delivered, total),
      conversionFromPrev:
        data.sent > 0 ? pct(data.delivered, data.sent) : null,
    },
    {
      key: "read",
      label: "Lido",
      value: data.read,
      icon: Eye,
      color: "bg-emerald-500 dark:bg-emerald-600",
      width: pct(data.read, total),
      conversionFromPrev:
        data.delivered > 0 ? pct(data.read, data.delivered) : null,
    },
  ];

  if (data.total === 0) {
    return (
      <div className="text-muted-foreground flex h-[180px] items-center justify-center text-xs">
        Sem disparos nos últimos 30 dias.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {steps.map((s) => {
        const Icon = s.icon;
        const ofTotal = pct(s.value, total);
        return (
          <div key={s.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="text-muted-foreground flex items-center gap-1.5">
                <Icon className="size-3" />
                {s.label}
                {s.key === "read" && <ReadRateInfo />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-semibold">
                  {s.value.toLocaleString("pt-BR")}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {ofTotal.toFixed(0)}% do total
                </span>
                {s.conversionFromPrev !== null && s.key !== "sent" && (
                  <span className="rounded bg-emerald-100/50 px-1 text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    {s.conversionFromPrev.toFixed(0)}% etapa
                  </span>
                )}
              </div>
            </div>
            <div className="bg-muted/40 relative h-6 overflow-hidden rounded">
              <div
                className={cn("h-full transition-all", s.color)}
                style={{ width: `${s.width}%` }}
              />
            </div>
          </div>
        );
      })}

      {data.failed > 0 && (
        <div className="border-destructive/20 bg-destructive/5 mt-3 flex items-center justify-between rounded border p-2 text-xs">
          <span className="text-destructive font-medium">
            {data.failed.toLocaleString("pt-BR")} falha(s)
          </span>
          <span className="text-muted-foreground text-[10px]">
            {pct(data.failed, data.total).toFixed(1)}% dos destinatários
          </span>
        </div>
      )}
    </div>
  );
}
