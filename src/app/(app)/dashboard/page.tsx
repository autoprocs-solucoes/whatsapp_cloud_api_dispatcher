import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Send,
  ShieldOff,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardAchievements } from "@/features/dashboard/dashboard-achievements";
import { DashboardFunnel } from "@/features/dashboard/dashboard-funnel";
import { DashboardTimeline } from "@/features/dashboard/dashboard-timeline";
import { ReadRateInfo } from "@/features/dashboard/read-rate-info";
import { getDashboardStats } from "@/features/dashboard/queries";

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

function pct(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n * 100)}%`;
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

  const { contacts, dispatches, timeline_30d, funnel_30d, achievements } = stats;
  const last = dispatches.last;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Visão geral do workspace — métricas dos últimos 30 dias + conquistas.
        </p>
      </header>

      {/* Gamificação / achievements */}
      <DashboardAchievements data={achievements} />

      {/* Linha de cards rápidos */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-md border p-4">
          <div className="flex items-center gap-2">
            <Users className="text-muted-foreground size-4" />
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Total de contatos
            </p>
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {contacts.total.toLocaleString("pt-BR")}
          </p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            <ShieldOff className="mr-0.5 inline size-3" />
            {contacts.opted_out} em opt-out
          </p>
        </div>

        <div className="bg-card rounded-md border p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="text-muted-foreground size-4" />
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Em execução
            </p>
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {dispatches.in_progress}
          </p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            comunicado(s) ativos
          </p>
        </div>

        <div className="bg-card rounded-md border p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-muted-foreground size-4" />
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Taxa de entrega (30d)
            </p>
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {pct(dispatches.delivery_rate_30d)}
          </p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            {dispatches.last_30d_count} disparo(s) nos últimos 30d
          </p>
        </div>

        <div className="bg-card rounded-md border p-4">
          <div className="flex items-center gap-2">
            <Send className="text-muted-foreground size-4" />
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Taxa de leitura (30d)
            </p>
            <ReadRateInfo />
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {pct(dispatches.read_rate_30d)}
          </p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            limite real depende do opt-in de leitura dos contatos
          </p>
        </div>
      </div>

      {/* Timeline + Funil lado-a-lado */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-md border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">Envios por dia</h2>
              <p className="text-muted-foreground text-xs">
                Últimos 30 dias · status atual de cada destinatário
              </p>
            </div>
            {achievements.best_day && (
              <div className="text-right">
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
                  Melhor dia
                </p>
                <p className="text-foreground text-sm font-semibold">
                  {new Date(
                    `${achievements.best_day.date}T00:00:00`,
                  ).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })}
                  {" · "}
                  {achievements.best_day.sent.toLocaleString("pt-BR")} envio(s)
                </p>
              </div>
            )}
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
      <section className="rounded-md border p-4">
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Link
                href={`/comunicados/${last.id}`}
                className="text-sm font-medium hover:underline"
              >
                {last.template_name ?? "Comunicado"}
              </Link>
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
            <Badge variant={statusBadgeVariant(last.status)} className="text-xs">
              {STATUS_LABELS[last.status] ?? last.status}
            </Badge>
          </div>
        )}
      </section>

      {/* Atalhos */}
      <section className="rounded-md border p-4">
        <h2 className="mb-3 text-sm font-medium">Atalhos</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/comunicados/novo">Novo comunicado</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contatos/importar">Importar contatos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/segmentos">Segmentos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/templates">Templates</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
