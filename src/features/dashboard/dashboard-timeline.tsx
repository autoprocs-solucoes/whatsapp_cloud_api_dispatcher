"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TimelineDay } from "@/features/dashboard/queries";

type Props = { data: TimelineDay[]; emptyMessage?: string };

// Sequência de entrega: cinza -> azul claro -> azul Meta, falha em vermelho.
const COLOR_SENT = "var(--d-sent)";
const COLOR_DELIVERED = "var(--d-deliv)";
const COLOR_READ = "var(--d-read)";
const COLOR_FAILED = "var(--d-fail)";

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function DashboardTimeline({
  data,
  emptyMessage = "Sem envios nos últimos 30 dias. Crie um comunicado pra começar.",
}: Props) {
  // Cada barra mostra a contagem terminal naquele dia: sent = só enviado
  // (ainda não entregue), delivered = entregue (não lido), read = lido.
  // queries.ts incrementa cumulativamente, então normalizamos aqui pra
  // contagem exclusiva e o empilhamento não dobrar visualmente.
  const chartData = data.map((d) => ({
    date: formatShortDate(d.date),
    "Só enviado": Math.max(0, d.sent - d.delivered),
    Entregue: Math.max(0, d.delivered - d.read),
    Lido: d.read,
    Falhou: d.failed,
  }));

  const totalAll = data.reduce((acc, d) => acc + d.sent + d.failed, 0);

  if (totalAll === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-xs text-ink-3">
        {emptyMessage}
      </div>
    );
  }

  // No máximo ~6 rótulos no eixo X — 30 datas coladas viram ruído.
  const tickInterval = Math.max(0, Math.ceil(chartData.length / 6) - 1);

  // Topo do eixo Y arredondado pra cima, pra os ticks caírem em números
  // redondos (0 / 100 / 200...) em vez do passo quebrado do auto-scale.
  const peak = Math.max(
    1,
    ...chartData.map((d) => Math.max(d["Só enviado"] + d.Entregue + d.Lido, d.Falhou)),
  );
  const step = Math.pow(10, Math.floor(Math.log10(peak / 4))) * (peak / 4 > 5 * Math.pow(10, Math.floor(Math.log10(peak / 4))) ? 10 : 5);
  const niceMax = Math.ceil(peak / step) * step;

  const legend = [
    { label: "Só enviado", color: COLOR_SENT },
    { label: "Entregue", color: COLOR_DELIVERED },
    { label: "Lido", color: COLOR_READ },
    { label: "Falhou", color: COLOR_FAILED },
  ];

  return (
    <div className="w-full space-y-2">
      <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--ink-3)" }}
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
            tickMargin={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--ink-3)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={44}
            domain={[0, niceMax]}
            ticks={Array.from({ length: niceMax / step + 1 }, (_, i) => i * step)}
          />
          <Tooltip
            cursor={{ fill: "var(--card-2)" }}
            contentStyle={{
              fontSize: 12,
              borderRadius: "var(--r-el)",
              padding: "8px 10px",
              background: "var(--popover)",
              border: "1px solid var(--line)",
              boxShadow: "var(--sh-card)",
            }}
            labelStyle={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}
            itemStyle={{ fontWeight: 600 }}
          />
          <Bar dataKey="Só enviado" stackId="a" fill={COLOR_SENT} maxBarSize={16} />
          <Bar dataKey="Entregue" stackId="a" fill={COLOR_DELIVERED} maxBarSize={16} />
          <Bar
            dataKey="Lido"
            stackId="a"
            fill={COLOR_READ}
            radius={[3, 3, 0, 0]}
            maxBarSize={16}
          />
          <Bar
            dataKey="Falhou"
            stackId="b"
            fill={COLOR_FAILED}
            radius={[3, 3, 0, 0]}
            maxBarSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-4 pl-10 text-xs text-ink-2">
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: l.color }} aria-hidden />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
