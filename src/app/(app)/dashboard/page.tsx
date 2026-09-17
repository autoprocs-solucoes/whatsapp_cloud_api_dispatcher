import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Send, Users } from "lucide-react";

import { AnimatedNumber } from "@/components/animated-number";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardFunnel } from "@/features/dashboard/dashboard-funnel";
import { DashboardTimeline } from "@/features/dashboard/dashboard-timeline";
import { ReadRateInfo } from "@/features/dashboard/read-rate-info";
import { getDashboardStats } from "@/features/dashboard/queries";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  running: "Em execução",
  done: "Concluído",
  failed: "Falhou",
  canceled: "Cancelado",
};

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "done":
      return "default";
    case "queued":
    case "running":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function pctValue(n: number | null): number | null {
  if (n === null) return null;
  return Math.round(n * 100);
}

type StatTileProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
  suffix?: string;
  caption?: React.ReactNode;
  delayMs: number;
};

function StatTile({ icon: Icon, label, value, suffix, caption, delayMs }: StatTileProps) {
  return (
    <div
      className="bg-card animate-in fade-in slide-in-from-bottom-1 rounded-md border p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-center gap-2">
        <Icon className="text-muted-foreground size-4" />
        <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-foreground mt-2 text-2xl font-semibold">
        {value === null ? "—" : <AnimatedNumber value={value} suffix={suffix} />}
      </p>
      {caption && <p className="text-muted-foreground mt-1 text-[11px]">{caption}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  if (!stats) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Não foi possível carregar as métricas.
          </p>
        </header>
      </div>
    );
  }

  const { contacts, total_sent_alltime, dispatches: dispatchStats, timeline_30d, funnel_30d } =
    stats;
  const last = dispatchStats.last;

  return (
    <div className="space-y-6">
      <header className="animate-in fade-in slide-in-from-bottom-1 duration-500">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral do workspace.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Send}
          label="Total enviado"
          value={total_sent_alltime}
          caption="mensagens desde sempre"
          delayMs={0}
        />
        <StatTile
          icon={Users}
          label="Total de contatos"
          value={contacts.total}
          delayMs={60}
        />
        <StatTile
          icon={CheckCircle2}
          label="Taxa de entrega (30d)"
          value={pctValue(dispatchStats.delivery_rate_30d)}
          suffix="%"
          delayMs={120}
        />
        <StatTile
          icon={Send}
          label="Taxa de leitura (30d)"
          value={pctValue(dispatchStats.read_rate_30d)}
          suffix="%"
          caption={<ReadRateInfo />}
          delayMs={180}
        />
      </div>

      {/* Timeline + Funil lado-a-lado */}
      <div
        className="animate-in fade-in slide-in-from-bottom-1 grid gap-4 duration-500 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
        style={{ animationDelay: "220ms", animationFillMode: "backwards" }}
      >
        <section className="rounded-md border p-4">
          <div className="mb-3">
            <h2 className="text-sm font-medium">Envios por dia</h2>
            <p className="text-muted-foreground text-xs">
              Últimos 30 dias · status atual de cada destinatário
            </p>
          </div>
          <DashboardTimeline data={timeline_30d} />
        </section>

        <section className="rounded-md border p-4">
          <div className="mb-3">
            <h2 className="text-sm font-medium">Funil de entrega</h2>
            <p className="text-muted-foreground text-xs">
              Últimos 30 dias · do destinatário ao lido
            </p>
          </div>
          <DashboardFunnel data={funnel_30d} />
        </section>
      </div>

      {/* Último comunicado */}
      <section
        className="animate-in fade-in slide-in-from-bottom-1 rounded-md border p-4 duration-500"
        style={{ animationDelay: "280ms", animationFillMode: "backwards" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Último comunicado</h2>
          <Button asChild size="sm" variant="ghost">
            <Link href="/comunicados">
              Ver todos <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        </div>

        {!last ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Nenhum comunicado ainda.{" "}
            <Link href="/comunicados/novo" className="text-primary hover:underline">
              Criar o primeiro
            </Link>
            .
          </p>
        ) : (
          <div
            className={cn(
              "flex flex-wrap items-end justify-between gap-4 rounded-md p-2 -m-2",
              "transition-colors duration-200 hover:bg-muted/30",
            )}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{last.template_name ?? "Comunicado"}</p>
                <Badge variant={statusBadgeVariant(last.status)} className="text-xs">
                  {STATUS_LABELS[last.status] ?? last.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                {new Date(last.created_at).toLocaleString("pt-BR")} ·{" "}
                {last.total_recipients} destinatário(s)
              </p>
              <div className="text-muted-foreground flex flex-wrap gap-3 text-[11px]">
                <span>Enviados: {last.sent + last.delivered + last.read}</span>
                <span>Entregues: {last.delivered + last.read}</span>
                <span>Lidos: {last.read}</span>
                <span className="text-destructive">Falhas: {last.failed}</span>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href={`/comunicados/${last.id}`}>
                <BarChart3 className="mr-1.5 size-4" /> Ver dashboard deste comunicado
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
