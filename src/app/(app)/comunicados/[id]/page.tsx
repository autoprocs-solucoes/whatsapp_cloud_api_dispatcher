import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Copy, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DispatchExecutePanel } from "@/features/dispatch/dispatch-execute-panel";
import { getDispatch } from "@/features/dispatch/actions";
import { ReadRateInfo } from "@/features/dashboard/read-rate-info";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  running: "Em execução",
  done: "Concluído",
  failed: "Falhou",
  canceled: "Cancelado",
};

const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  queued: "Aguardando",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "done":
    case "delivered":
    case "read":
    case "sent":
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

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ status?: string; page?: string }>;

export default async function ComunicadoDetalhe({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const page = sp.page ? Math.max(1, Number(sp.page)) : 1;
  const statusFilter = sp.status ?? "all";

  const detail = await getDispatch(id, { page, pageSize: 50, statusFilter });
  if (!detail) notFound();

  const { dispatch, template, recipients, totalRecipients, counts, reactionCount } = detail;
  const totalPages = Math.max(1, Math.ceil(totalRecipients / 50));

  const total = dispatch.total_recipients || 0;
  const sentLike = (counts.sent ?? 0) + (counts.delivered ?? 0) + (counts.read ?? 0);
  const deliveredLike = (counts.delivered ?? 0) + (counts.read ?? 0);
  const readCount = counts.read ?? 0;
  const failedCount = counts.failed ?? 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/comunicados">
            <ChevronLeft className="mr-1 size-4" /> Voltar
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {template?.name ?? "Comunicado"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {template?.language} ·{" "}
              {dispatch.recipient_source === "segment" ? "Segmento" : "Lista manual"} ·{" "}
              {new Date(dispatch.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusBadgeVariant(dispatch.status)} className="text-xs">
              {STATUS_LABELS[dispatch.status] ?? dispatch.status}
            </Badge>
            <Button asChild size="sm" variant="outline">
              <Link href={`/comunicados/novo?from=${dispatch.id}`}>
                <Copy className="mr-1 size-4" /> Duplicar
              </Link>
            </Button>
            {totalRecipients > 0 && (
              <Button asChild size="sm" variant="outline">
                <a href={`/comunicados/${dispatch.id}/export`} download>
                  <Download className="mr-1 size-4" /> Exportar CSV
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {(dispatch.status === "draft" ||
        dispatch.status === "queued" ||
        dispatch.status === "running") && (
        <DispatchExecutePanel
          dispatchId={dispatch.id}
          total={dispatch.total_recipients}
          status={dispatch.status}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["queued", "sent", "delivered", "read", "failed"] as const).map((s) => (
          <div
            key={s}
            className={cn(
              "rounded-md border bg-background p-3 text-center",
              s === "failed" && "border-destructive/30",
            )}
          >
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
              {RECIPIENT_STATUS_LABELS[s]}
            </p>
            <p className="text-foreground text-xl font-semibold">{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="bg-muted/40 rounded-md border p-3">
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
            Taxa de envio
          </p>
          <p className="text-foreground text-lg font-semibold">{pct(sentLike)}%</p>
          <p className="text-muted-foreground text-[10px]">
            {sentLike} de {total}
          </p>
        </div>
        <div className="bg-muted/40 rounded-md border p-3">
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
            Taxa de entrega
          </p>
          <p className="text-foreground text-lg font-semibold">{pct(deliveredLike)}%</p>
          <p className="text-muted-foreground text-[10px]">
            {deliveredLike} de {total}
          </p>
        </div>
        <div className="bg-muted/40 rounded-md border p-3">
          <div className="flex items-center justify-center gap-1">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Taxa de leitura
            </p>
            <ReadRateInfo />
          </div>
          <p className="text-foreground text-lg font-semibold">{pct(readCount)}%</p>
          <p className="text-muted-foreground text-[10px]">
            {readCount} de {total}
          </p>
        </div>
        <div className="bg-muted/40 rounded-md border p-3">
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
            Reações
          </p>
          <p className="text-foreground text-lg font-semibold">{pct(reactionCount)}%</p>
          <p className="text-muted-foreground text-[10px]">
            {reactionCount} de {total}
          </p>
        </div>
        <div className="border-destructive/30 bg-destructive/5 rounded-md border p-3">
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
            Taxa de falha
          </p>
          <p className="text-destructive text-lg font-semibold">{pct(failedCount)}%</p>
          <p className="text-muted-foreground text-[10px]">
            {failedCount} de {total}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">
            {totalRecipients} destinatário(s){" "}
            {statusFilter !== "all" ? `com status "${RECIPIENT_STATUS_LABELS[statusFilter] ?? statusFilter}"` : ""}
          </p>
          <div className="flex gap-1">
            {(["all", "queued", "sent", "delivered", "read", "failed"] as const).map((f) => (
              <Button
                key={f}
                asChild
                size="sm"
                variant={statusFilter === f ? "default" : "outline"}
              >
                <Link href={`/comunicados/${dispatch.id}?status=${f}`}>
                  {f === "all" ? "Todos" : RECIPIENT_STATUS_LABELS[f]}
                </Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Telefone</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Enviado em</th>
                <th className="px-3 py-2 text-left font-medium">Entregue em</th>
                <th className="px-3 py-2 text-left font-medium">Lido em</th>
                <th className="px-3 py-2 text-left font-medium">Reação</th>
                <th className="px-3 py-2 text-left font-medium">Erro</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted-foreground px-3 py-8 text-center">
                    Nenhum destinatário nesse filtro.
                  </td>
                </tr>
              ) : (
                recipients.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{r.phone_e164}</td>
                    <td className="px-3 py-2">
                      <Badge variant={statusBadgeVariant(r.status)} className="text-[10px]">
                        {RECIPIENT_STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {r.sent_at ? new Date(r.sent_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {r.delivered_at ? new Date(r.delivered_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {r.read_at ? new Date(r.read_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.reaction_emoji ? (
                        <span
                          title={
                            r.reaction_at
                              ? new Date(r.reaction_at).toLocaleString("pt-BR")
                              : undefined
                          }
                          className="text-base leading-none"
                        >
                          {r.reaction_emoji}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {r.error_message ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-end gap-1 text-xs">
            <span className="text-muted-foreground mr-2">
              página {page} de {totalPages}
            </span>
            <Button
              asChild
              size="sm"
              variant="outline"
              disabled={page <= 1}
            >
              <Link href={`/comunicados/${dispatch.id}?status=${statusFilter}&page=${page - 1}`}>
                Anterior
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
            >
              <Link href={`/comunicados/${dispatch.id}?status=${statusFilter}&page=${page + 1}`}>
                Próxima
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
