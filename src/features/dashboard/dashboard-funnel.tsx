import { CheckCheck, Eye, Send, Users2 } from "lucide-react";

import { ReadRateInfo } from "@/features/dashboard/read-rate-info";
import type { FunnelStats } from "@/features/dashboard/queries";

type Props = { data: FunnelStats };

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.max(0, Math.min(100, (n / d) * 100));
}

export function DashboardFunnel({ data }: Props) {
  const total = Math.max(data.total, 1);

  // Barra fica mais azul a cada etapa: cinza -> azul claro -> azul médio ->
  // azul Meta.
  const steps = [
    {
      key: "total",
      label: "Destinatários",
      value: data.total,
      icon: Users2,
      color: "var(--line-3)",
      stage: null as number | null,
    },
    {
      key: "sent",
      label: "Enviado",
      value: data.sent,
      icon: Send,
      color: "var(--d-deliv)",
      stage: data.total > 0 ? pct(data.sent, data.total) : null,
    },
    {
      key: "delivered",
      label: "Entregue",
      value: data.delivered,
      icon: CheckCheck,
      color: "var(--brand-2)",
      stage: data.sent > 0 ? pct(data.delivered, data.sent) : null,
    },
    {
      key: "read",
      label: "Lido",
      value: data.read,
      icon: Eye,
      color: "var(--brand)",
      stage: data.delivered > 0 ? pct(data.read, data.delivered) : null,
    },
  ];

  if (data.total === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-xs text-ink-3">
        Sem disparos nos últimos 30 dias.
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {steps.map((s) => {
        const Icon = s.icon;
        const ofTotal = pct(s.value, total);
        return (
          <div key={s.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs whitespace-nowrap">
              <span className="flex min-w-0 items-center gap-1.5 truncate text-ink-2">
                <Icon className="size-3.5 text-ink-3" />
                {s.label}
                {s.key === "read" && <ReadRateInfo />}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {s.stage !== null && s.key !== "sent" && (
                  <span className="shrink-0 rounded-full border border-brand-line bg-brand-soft px-1.5 py-px text-[10px] font-semibold whitespace-nowrap text-brand-strong">
                    {s.stage.toFixed(0)}% etapa
                  </span>
                )}
                <span className="shrink-0 text-ink-3">{ofTotal.toFixed(0)}%</span>
                <span className="num min-w-[44px] text-right text-[13px]">
                  {s.value.toLocaleString("pt-BR")}
                </span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-card-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${ofTotal}%`, background: s.color }}
              />
            </div>
          </div>
        );
      })}

      {data.failed > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-red-line bg-red-soft px-2.5 py-2 text-xs">
          <span className="font-semibold whitespace-nowrap text-red">
            {data.failed.toLocaleString("pt-BR")} falhas
          </span>
          <span className="text-ink-2">
            {pct(data.failed, data.total).toFixed(0)}% dos destinatários não receberam
          </span>
        </div>
      )}
    </div>
  );
}
