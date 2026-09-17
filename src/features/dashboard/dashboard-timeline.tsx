"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TimelineDay } from "@/features/dashboard/queries";

type Props = { data: TimelineDay[]; emptyMessage?: string };

// Paleta: rampa ordinal azul pra progressão sent -> delivered (menos ->
// mais avançado), cores de status (fixas, não têm variante dark separada)
// pro estado bom (lido) e crítico (falhou). Ver skill de dataviz.
const COLOR_SENT = "var(--chart-ordinal-1)";
const COLOR_DELIVERED = "var(--chart-ordinal-2)";
const COLOR_READ = "var(--chart-status-good)";
const COLOR_FAILED = "var(--chart-status-critical)";

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function DashboardTimeline({
  data,
  emptyMessage = "Sem envios nos últimos 30 dias. Crie um comunicado pra começar.",
}: Props) {
  // Cada barra mostra a contagem terminal naquele dia.
  // sent = só sent (não delivered ainda), delivered = delivered (não read),
  // read = chegou a leitura, failed = falhou.
  // Como queries.ts incrementa cumulativamente, normalizamos pra contagem
  // exclusiva aqui pro stacked bar não dobrar visualmente.
  const chartData = data.map((d) => ({
    date: formatShortDate(d.date),
    rawDate: d.date,
    "Só enviado": Math.max(0, d.sent - d.delivered),
    Entregue: Math.max(0, d.delivered - d.read),
    Lido: d.read,
    Falhou: d.failed,
  }));

  const totalAll = data.reduce((acc, d) => acc + d.sent + d.failed, 0);

  if (totalAll === 0) {
    return (
      <div className="text-muted-foreground flex h-[220px] items-center justify-center text-xs">
        {emptyMessage}
      </div>
    );
  }

  // No máximo ~6 rótulos no eixo X — 30 datas coladas viram ruído ilegível.
  const tickInterval = Math.max(0, Math.ceil(chartData.length / 6) - 1);

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
            tickMargin={8}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              padding: "8px 10px",
              background: "var(--popover)",
              border: "1px solid var(--border)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
            labelStyle={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}
            itemStyle={{ fontWeight: 600 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconSize={8}
            iconType="circle"
          />
          <Bar
            dataKey="Só enviado"
            stackId="a"
            fill={COLOR_SENT}
            stroke="var(--card)"
            strokeWidth={2}
            maxBarSize={18}
          />
          <Bar
            dataKey="Entregue"
            stackId="a"
            fill={COLOR_DELIVERED}
            stroke="var(--card)"
            strokeWidth={2}
            maxBarSize={18}
          />
          <Bar
            dataKey="Lido"
            stackId="a"
            fill={COLOR_READ}
            stroke="var(--card)"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Bar
            dataKey="Falhou"
            stackId="b"
            fill={COLOR_FAILED}
            stroke="var(--card)"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
