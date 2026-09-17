import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardFunnel } from "@/features/dashboard/dashboard-funnel";
import { DashboardTimeline } from "@/features/dashboard/dashboard-timeline";
import { getWorkspaceDetailForMaster } from "@/server/master";
import { listDispatchesForMaster } from "@/server/master-dispatches";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  running: "Em execução",
  done: "Concluído",
  failed: "Falhou",
  canceled: "Cancelado",
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
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

function healthBadgeVariant(status: string | null): "default" | "secondary" | "destructive" {
  switch (status) {
    case "AVAILABLE":
      return "default";
    case "LIMITED":
      return "secondary";
    case "BLOCKED":
      return "destructive";
    default:
      return "secondary";
  }
}

type Params = Promise<{ id: string }>;

export default async function MasterWorkspaceDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const [detail, dispatches] = await Promise.all([
    getWorkspaceDetailForMaster(id),
    listDispatchesForMaster(id),
  ]);
  if (!detail) notFound();

  const { workspace, members, connections, stats } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/master">
            <ChevronLeft className="mr-1 size-4" /> Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
        <p className="text-muted-foreground text-sm">
          {workspace.slug} · Owner principal: {workspace.ownerEmail ?? "—"} · Criado em{" "}
          {new Date(workspace.createdAt).toLocaleDateString("pt-BR")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-md border p-4">
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
            Total enviado
          </p>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {stats.total_sent_alltime.toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="bg-card rounded-md border p-4">
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
            Total de contatos
          </p>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {stats.contacts.total.toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="bg-card rounded-md border p-4">
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
            Taxa de entrega (30d)
          </p>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {stats.dispatches.delivery_rate_30d !== null
              ? `${Math.round(stats.dispatches.delivery_rate_30d * 100)}%`
              : "—"}
          </p>
        </div>
        <div className="bg-card rounded-md border p-4">
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
            Taxa de leitura (30d)
          </p>
          <p className="text-foreground mt-2 text-2xl font-semibold">
            {stats.dispatches.read_rate_30d !== null
              ? `${Math.round(stats.dispatches.read_rate_30d * 100)}%`
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-md border p-4">
          <h2 className="mb-3 text-sm font-medium">Envios por dia (30d)</h2>
          <DashboardTimeline data={stats.timeline_30d} />
        </section>
        <section className="rounded-md border p-4">
          <h2 className="mb-3 text-sm font-medium">Funil de entrega (30d)</h2>
          <DashboardFunnel data={stats.funnel_30d} />
        </section>
      </div>

      <section className="rounded-md border p-4">
        <h2 className="mb-3 text-sm font-medium">Membros ({members.length})</h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between text-sm">
              <span>{m.email ?? m.user_id}</span>
              <Badge variant={m.role === "owner" ? "default" : "outline"} className="text-[10px]">
                {m.role}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border p-4">
        <h2 className="mb-3 text-sm font-medium">Conexões Meta ({connections.length})</h2>
        {connections.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sem conexão Meta.</p>
        ) : (
          <div className="space-y-4">
            {connections.map(({ connection, phoneNumbers }) => {
              const health = connection.health_status as { can_send_message?: string } | null;
              return (
                <div key={connection.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {connection.business_name ?? "Business sem nome"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        WABA {connection.waba_id} · {connection.connection_method}
                      </p>
                    </div>
                    <Badge variant={healthBadgeVariant(health?.can_send_message ?? null)}>
                      {health?.can_send_message ?? "—"}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1">
                    {phoneNumbers.map((p) => (
                      <div
                        key={p.id}
                        className="text-muted-foreground flex items-center justify-between text-xs"
                      >
                        <span>{p.display_phone_number}</span>
                        <span>Quality: {p.quality_rating ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-md border p-4">
        <h2 className="mb-3 text-sm font-medium">Comunicados ({dispatches.length})</h2>
        {dispatches.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum comunicado ainda.</p>
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
                    <tr key={d.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{d.templateName ?? "—"}</td>
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
                        {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
