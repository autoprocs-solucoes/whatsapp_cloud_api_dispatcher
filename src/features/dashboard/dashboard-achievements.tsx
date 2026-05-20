import { Flame, Target, TrendingDown, TrendingUp, Trophy } from "lucide-react";

import type { Achievements } from "@/features/dashboard/queries";
import { cn } from "@/lib/utils";

type Props = { data: Achievements };

function formatNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatMonthDelta(d: number | null): { text: string; positive: boolean | null } {
  if (d === null) return { text: "—", positive: null };
  if (d === 0) return { text: "0%", positive: null };
  const sign = d > 0 ? "+" : "";
  return { text: `${sign}${Math.round(d * 100)}%`, positive: d > 0 };
}

export function DashboardAchievements({ data }: Props) {
  const delta = formatMonthDelta(data.month_delta_pct);
  const milestoneProgressPct = Math.round(data.next_milestone_progress * 100);
  const remaining = Math.max(0, data.next_milestone - data.total_sent_alltime);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total all-time */}
      <div className="bg-card relative overflow-hidden rounded-md border p-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
          <Trophy className="size-3.5" />
          Total enviado
        </div>
        <p className="text-foreground mt-2 text-2xl font-semibold">
          {formatNum(data.total_sent_alltime)}
        </p>
        <p className="text-muted-foreground mt-1 text-[11px]">
          mensagens desde sempre
        </p>
      </div>

      {/* Mês vs mês anterior */}
      <div className="bg-card rounded-md border p-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
          {delta.positive === true ? (
            <TrendingUp className="size-3.5 text-emerald-500" />
          ) : delta.positive === false ? (
            <TrendingDown className="size-3.5 text-rose-500" />
          ) : (
            <TrendingUp className="size-3.5" />
          )}
          Mês atual
        </div>
        <p className="text-foreground mt-2 text-2xl font-semibold">
          {formatNum(data.this_month_sent)}
        </p>
        <p
          className={cn(
            "mt-1 text-[11px]",
            delta.positive === true && "text-emerald-600 dark:text-emerald-400",
            delta.positive === false && "text-rose-600 dark:text-rose-400",
            delta.positive === null && "text-muted-foreground",
          )}
        >
          {delta.text} vs mês anterior ({formatNum(data.last_month_sent)})
        </p>
      </div>

      {/* Streak */}
      <div className="bg-card rounded-md border p-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
          <Flame
            className={cn(
              "size-3.5",
              data.streak_days >= 3 && "text-orange-500",
            )}
          />
          Streak
        </div>
        <p className="text-foreground mt-2 text-2xl font-semibold">
          {data.streak_days} {data.streak_days === 1 ? "dia" : "dias"}
        </p>
        <p className="text-muted-foreground mt-1 text-[11px]">
          {data.streak_days === 0
            ? "Dispare hoje pra iniciar"
            : "consecutivo(s) com disparo"}
        </p>
      </div>

      {/* Próximo marco */}
      <div className="bg-card overflow-hidden rounded-md border p-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
          <Target className="size-3.5" />
          Próximo marco
        </div>
        <p className="text-foreground mt-2 text-2xl font-semibold">
          {formatNum(data.next_milestone)}
        </p>
        <p className="text-muted-foreground mt-1 text-[11px]">
          faltam {formatNum(remaining)} mensagens
        </p>
        <div className="bg-muted/40 mt-2 h-1.5 overflow-hidden rounded">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
            style={{ width: `${milestoneProgressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
