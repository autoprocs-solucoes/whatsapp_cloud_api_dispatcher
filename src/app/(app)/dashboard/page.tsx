import Link from "next/link";
import { ArrowRight, CheckCircle2, Send, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardFunnel } from "@/features/dashboard/dashboard-funnel";
import { DashboardTimeline } from "@/features/dashboard/dashboard-timeline";
import { ReadRateInfo } from "@/features/dashboard/read-rate-info";
import { getDashboardStats } from "@/features/dashboard/queries";
import { listDispatches } from "@/features/dispatch/actions";

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
  const [stats, dispatches] = await Promise.all([getDashboardStats(), listDispatches()]);

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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral do workspace.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-md border p-4">
          <div className="flex items-center gap-2">
            <Send className="text-muted-foreground size-4" />
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Total enviado
            </p>
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {total_sent_alltime.toLocaleString("pt-BR")}
          </p>
          <p className="text-muted-foreground mt-1 text-[11px]">mensagens desde sempre</p>
        </div>

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
        </div>

        <div className="bg-card rounded-md border p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-muted-foreground size-4" />
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Taxa de entrega (30d)
            </p>
          </div>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {pct(dispatchStats.delivery_rate_30d)}
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
            {pct(dispatchStats.read_rate_30d)}
          </p>
        </div>
      </div>

      {/* Timeline + Funil lado-a-lado */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
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

      {/* Dashboards por comunicado — métricas separadas de cada disparo */}
      <section className="rounded-md border p-4">
        <div className="mb-3">
          <h2 className="text-sm font-medium">Comunicados enviados</h2>
          <p className="text-muted-foreground text-xs">
            Clique num comunicado pra ver o dashboard dele (funil, tendência diária e erros).
          </p>
        </div>

        {dispatches.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Nenhum comunicado enviado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Template</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Enviados</th>
                  <th className="px-3 py-2 text-right font-medium">Entregues</th>
                  <th className="px-3 py-2 text-right font-medium">Lidos</th>
                  <th className="px-3 py-2 text-right font-medium">Falhas</th>
                  <th className="px-3 py-2 text-left font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((d) => {
                  const sent = d.counts.sent ?? 0;
                  const delivered = d.counts.delivered ?? 0;
                  const read = d.counts.read ?? 0;
                  const failed = d.counts.failed ?? 0;
                  return (
                    <tr key={d.id} className="hover:bg-muted/20 border-t">
                      <td className="px-3 py-2 font-medium">
                        <Link href={`/comunicados/${d.id}`} className="hover:underline">
                          {d.template_name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusBadgeVariant(d.status)} className="text-[10px]">
                          {STATUS_LABELS[d.status] ?? d.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-xs">{sent + delivered + read}</td>
                      <td className="px-3 py-2 text-right text-xs">{delivered + read}</td>
                      <td className="px-3 py-2 text-right text-xs">{read}</td>
                      <td className="text-destructive px-3 py-2 text-right text-xs">{failed}</td>
                      <td className="text-muted-foreground px-3 py-2 text-xs">
                        {new Date(d.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
