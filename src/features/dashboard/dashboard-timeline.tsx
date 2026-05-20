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

type Props = { data: TimelineDay[] };

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function DashboardTimeline({ data }: Props) {
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

  const totalAll = data.reduce(
    (acc, d) => acc + d.sent + d.failed,
    0,
  );

  if (totalAll === 0) {
    return (
      <div className="text-muted-foreground flex h-[220px] items-center justify-center text-xs">
        Sem envios nos últimos 30 dias. Crie um comunicado pra começar.
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="2 4" vertical={false} opacity={0.3} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            tickMargin={6}
          />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={32} />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 6,
              padding: "6px 8px",
            }}
            labelStyle={{ fontSize: 11, fontWeight: 600 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            iconSize={8}
            iconType="circle"
          />
          <Bar dataKey="Só enviado" stackId="a" fill="#94a3b8" radius={0} />
          <Bar dataKey="Entregue" stackId="a" fill="#60a5fa" radius={0} />
          <Bar dataKey="Lido" stackId="a" fill="#22c55e" radius={[3, 3, 0, 0]} />
          <Bar
            dataKey="Falhou"
            stackId="b"
            fill="#ef4444"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
