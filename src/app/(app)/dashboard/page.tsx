import Link from "next/link";
import { ArrowRight, BarChart3, Plus } from "lucide-react";

import { KpiTile } from "@/components/kpi-tile";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardFunnel } from "@/features/dashboard/dashboard-funnel";
import { DashboardTimeline } from "@/features/dashboard/dashboard-timeline";
import { getDashboardStats } from "@/features/dashboard/queries";
import { requireActiveWorkspace } from "@/server/workspace";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  running: "Enviando",
  done: "Concluído",
  failed: "Falhou",
  canceled: "Cancelado",
};

function statusTone(status: string) {
  switch (status) {
    case "done":
      return "ok" as const;
    case "queued":
    case "running":
      return "pending" as const;
    case "failed":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function initials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function pctValue(n: number | null): number | null {
  if (n === null) return null;
  return Math.round(n * 100);
}

function MiniMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md border border-line bg-card-2 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] text-ink-2">
        <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </p>
      <p className="num mt-0.5 text-lg leading-none">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const [workspace, stats] = await Promise.all([requireActiveWorkspace(), getDashboardStats()]);

  if (!stats) {
    return <PageHeader title="Dashboard" description="Não foi possível carregar as métricas." />;
  }

  const { contacts, total_sent_alltime, dispatches: dispatchStats, timeline_30d, funnel_30d } =
    stats;
  const last = dispatchStats.last;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`Panorama de envios, entrega e leitura do workspace ${workspace.name}.`}
        actions={
          <Button asChild size="sm">
            <Link href="/comunicados/novo">
              <Plus className="size-4" /> Novo comunicado
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Total enviados"
          value={total_sent_alltime.toLocaleString("pt-BR")}
          caption="mensagens desde sempre"
        />
        <KpiTile
          label="Total de contatos"
          value={contacts.total.toLocaleString("pt-BR")}
          caption="na base do workspace"
        />
        <KpiTile
          label="Taxa de entrega"
          value={pctValue(dispatchStats.delivery_rate_30d)}
          suffix="%"
          caption={`${funnel_30d.delivered.toLocaleString("pt-BR")} de ${funnel_30d.total.toLocaleString("pt-BR")} · 30d`}
        />
        <KpiTile
          label="Taxa de leitura"
          value={pctValue(dispatchStats.read_rate_30d)}
          suffix="%"
          caption={`${funnel_30d.read.toLocaleString("pt-BR")} lidas · 30d`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Envios por dia</CardTitle>
              <CardDescription>Últimos 30 dias · status atual de cada destinatário</CardDescription>
            </div>
            <CardAction>
              <span className="rounded-full border border-line-2 bg-card-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                30 dias
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <DashboardTimeline data={timeline_30d} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Funil de entrega</CardTitle>
              <CardDescription>Do destinatário ao lido · últimos 30 dias</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <DashboardFunnel data={funnel_30d} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Último comunicado</CardTitle>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/comunicados">
                Ver todos <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {!last ? (
            <p className="py-6 text-center text-sm text-ink-3">
              Nenhum comunicado ainda.{" "}
              <Link href="/comunicados/novo" className="font-medium text-brand hover:underline">
                Criar o primeiro
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-card-2 text-[11px] font-semibold text-ink-2">
                  {initials(last.template_name ?? "Comunicado")}
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">
                      {last.template_name ?? "Comunicado"}
                    </p>
                    <StatusBadge tone={statusTone(last.status)}>
                      {STATUS_LABELS[last.status] ?? last.status}
                    </StatusBadge>
                  </div>
                  <p className="font-mono text-[11px] text-ink-3">
                    {new Date(last.created_at).toLocaleString("pt-BR")} ·{" "}
                    {last.total_recipients.toLocaleString("pt-BR")} destinatários
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <MiniMetric
                  label="Enviados"
                  value={last.sent + last.delivered + last.read}
                  color="var(--d-sent)"
                />
                <MiniMetric
                  label="Entregues"
                  value={last.delivered + last.read}
                  color="var(--d-deliv)"
                />
                <MiniMetric label="Lidos" value={last.read} color="var(--d-read)" />
                <MiniMetric label="Falhas" value={last.failed} color="var(--d-fail)" />
                <Button asChild variant="outline" size="sm">
                  <Link href={`/comunicados/${last.id}`}>
                    <BarChart3 className="size-4" /> Ver dashboard do disparo
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
