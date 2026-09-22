import Link from "next/link";
import { ArrowRight, BarChart3, Plus } from "lucide-react";

import { KpiTile } from "@/components/kpi-tile";
import { PageHeader } from "@/components/page-header";
import { StageCard } from "@/components/stage-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BiggestLossCard } from "@/features/dashboard/biggest-loss-card";
import { DeliveryFunnel } from "@/features/dashboard/delivery-funnel";
import { DashboardTimeline } from "@/features/dashboard/dashboard-timeline";
import { ReadRateInfo } from "@/features/dashboard/read-rate-info";
import { getDashboardStats } from "@/features/dashboard/queries";
import { formatInt, formatPct, rate } from "@/lib/metrics/funnel";
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

/** Métrica compacta da última transmissão: valor, base e a conta pronta. */
function MiniMetric({
  label,
  value,
  base,
  baseLabel,
  color,
}: {
  label: string;
  value: number;
  base: number;
  baseLabel: string;
  color: string;
}) {
  return (
    <div className="rounded-md border border-line bg-card-2 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] text-ink-2">
        <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </p>
      <p className="num mt-0.5 text-lg leading-none">
        {formatInt(value)}
        <span className="text-[12px] text-ink-3"> / {formatInt(base)}</span>
      </p>
      <p className="mt-0.5 text-[10px] text-ink-3">
        {formatPct(rate(value, base))} {baseLabel}
      </p>
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
            <Link href="/transmissao/nova">
              <Plus className="size-4" /> Nova transmissão
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
        <StageCard
          label="Entregues · 30d"
          value={funnel_30d.delivered}
          base={funnel_30d.sent}
          baseLabel="das enviadas"
          secondary={`${formatPct(rate(funnel_30d.delivered, funnel_30d.planned))} do programado`}
          tone="brand"
        />
        <StageCard
          label="Lidas · 30d"
          value={funnel_30d.read}
          base={funnel_30d.delivered}
          baseLabel="das entregues"
          secondary={`${formatPct(rate(funnel_30d.read, funnel_30d.planned))} do programado`}
          tone="ok"
          hint={<ReadRateInfo />}
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
              <CardDescription>
                Do programado ao lido · últimos 30 dias · rascunhos não contam
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <DeliveryFunnel data={funnel_30d} emptyMessage="Sem disparos nos últimos 30 dias." />
            {funnel_30d.planned > 0 && <BiggestLossCard data={funnel_30d} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Última transmissão</CardTitle>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/transmissao">
                Ver todos <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {!last ? (
            <p className="py-6 text-center text-sm text-ink-3">
              Nenhuma transmissão ainda.{" "}
              <Link href="/transmissao/nova" className="font-medium text-brand hover:underline">
                Criar o primeiro
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-card-2 text-[11px] font-semibold text-ink-2">
                  {initials(last.template_name ?? "Transmissão")}
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">
                      {last.template_name ?? "Transmissão"}
                    </p>
                    <StatusBadge tone={statusTone(last.status)}>
                      {STATUS_LABELS[last.status] ?? last.status}
                    </StatusBadge>
                  </div>
                  <p className="font-mono text-[11px] text-ink-3">
                    {new Date(last.created_at).toLocaleString("pt-BR")} ·{" "}
                    {formatInt(last.funnel.planned)} programadas
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <MiniMetric
                  label="Enviadas"
                  value={last.funnel.sent}
                  base={last.funnel.planned}
                  baseLabel="do programado"
                  color="var(--d-sent)"
                />
                <MiniMetric
                  label="Entregues"
                  value={last.funnel.delivered}
                  base={last.funnel.sent}
                  baseLabel="das enviadas"
                  color="var(--d-deliv)"
                />
                <MiniMetric
                  label="Lidas"
                  value={last.funnel.read}
                  base={last.funnel.delivered}
                  baseLabel="das entregues"
                  color="var(--d-read)"
                />
                <MiniMetric
                  label="Falhas"
                  value={last.funnel.failed}
                  base={last.funnel.planned}
                  baseLabel="do programado"
                  color="var(--d-fail)"
                />
                <Button asChild variant="outline" size="sm">
                  <Link href={`/transmissao/${last.id}`}>
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
