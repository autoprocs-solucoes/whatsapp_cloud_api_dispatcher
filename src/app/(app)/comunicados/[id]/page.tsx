import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Copy, Download } from "lucide-react";

import { KpiTile } from "@/components/kpi-tile";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  TableToolbar,
} from "@/components/ui/table";
import { DispatchExecutePanel } from "@/features/dispatch/dispatch-execute-panel";
import { getDispatch } from "@/features/dispatch/actions";
import { DashboardTimeline } from "@/features/dashboard/dashboard-timeline";
import { ReadRateInfo } from "@/features/dashboard/read-rate-info";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  running: "Enviando",
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

function statusTone(status: string): StatusTone {
  switch (status) {
    case "done":
    case "delivered":
    case "read":
      return "ok";
    case "sent":
      return "info";
    case "queued":
    case "running":
      return "pending";
    case "failed":
      return "danger";
    default:
      return "neutral";
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

  const {
    dispatch,
    template,
    recipients,
    totalRecipients,
    counts,
    reactionCount,
    timeline,
    errorGroups,
  } = detail;
  const totalPages = Math.max(1, Math.ceil(totalRecipients / 50));

  const total = dispatch.total_recipients || 0;
  const sentLike = (counts.sent ?? 0) + (counts.delivered ?? 0) + (counts.read ?? 0);
  const deliveredLike = (counts.delivered ?? 0) + (counts.read ?? 0);
  const readCount = counts.read ?? 0;
  const failedCount = counts.failed ?? 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/comunicados">
            <ChevronLeft className="size-4" /> Voltar
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-[23px] leading-tight font-semibold tracking-tight text-ink">
              {template?.name ?? "Comunicado"}
            </h1>
            <p className="text-sm text-ink-2">
              {template?.language} ·{" "}
              {dispatch.recipient_source === "segment" ? "Segmento" : "Lista manual"} ·{" "}
              <span className="font-mono text-xs">
                {new Date(dispatch.created_at).toLocaleString("pt-BR")}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusTone(dispatch.status)}>
              {STATUS_LABELS[dispatch.status] ?? dispatch.status}
            </StatusBadge>
            <Button asChild size="sm" variant="outline">
              <Link href={`/comunicados/novo?from=${dispatch.id}`}>
                <Copy className="size-4" /> Duplicar
              </Link>
            </Button>
            {totalRecipients > 0 && (
              <Button asChild size="sm" variant="outline">
                <a href={`/comunicados/${dispatch.id}/export`} download>
                  <Download className="size-4" /> Exportar CSV
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {(["queued", "sent", "delivered", "read", "failed"] as const).map((s) => (
          <KpiTile
            key={s}
            label={RECIPIENT_STATUS_LABELS[s] ?? s}
            value={(counts[s] ?? 0).toLocaleString("pt-BR")}
            tone={s === "failed" ? "danger" : "default"}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <KpiTile
          label="Taxa de envio"
          value={pct(sentLike)}
          suffix="%"
          tone="muted"
          caption={`${sentLike} de ${total}`}
        />
        <KpiTile
          label="Taxa de entrega"
          value={pct(deliveredLike)}
          suffix="%"
          tone="muted"
          caption={`${deliveredLike} de ${total}`}
        />
        <KpiTile
          label="Taxa de leitura"
          value={pct(readCount)}
          suffix="%"
          tone="muted"
          caption={
            <span className="inline-flex items-center gap-1">
              {readCount} de {total} <ReadRateInfo />
            </span>
          }
        />
        <KpiTile
          label="Reações"
          value={pct(reactionCount)}
          suffix="%"
          tone="muted"
          caption={`${reactionCount} de ${total}`}
        />
        <KpiTile
          label="Taxa de falha"
          value={pct(failedCount)}
          suffix="%"
          tone="danger"
          caption={`${failedCount} de ${total}`}
        />
      </div>

      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tendência</CardTitle>
            <CardDescription>Envios deste comunicado por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardTimeline data={timeline} emptyMessage="Sem envios ainda." />
          </CardContent>
        </Card>
      )}

      {errorGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Erros mais comuns</CardTitle>
            <CardDescription>{failedCount} falha(s) agrupadas por causa</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Código</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead className="text-right">Ocorrências</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {errorGroups.map((g, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs text-ink-2">
                      {g.error_code || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-ink-2">{g.error_message || "—"}</TableCell>
                    <TableCell className="num text-right text-[13px]">{g.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-2">
            {totalRecipients.toLocaleString("pt-BR")} destinatário(s)
            {statusFilter !== "all"
              ? ` com status "${RECIPIENT_STATUS_LABELS[statusFilter] ?? statusFilter}"`
              : ""}
          </p>
          <div className="flex flex-wrap items-center rounded-md border border-line-2 bg-card p-0.5">
            {(["all", "queued", "sent", "delivered", "read", "failed"] as const).map((f) => (
              <Link
                key={f}
                href={`/comunicados/${dispatch.id}?status=${f}`}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-[13px] font-medium transition-colors",
                  statusFilter === f
                    ? "bg-brand-soft text-brand-strong"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                {f === "all" ? "Todos" : RECIPIENT_STATUS_LABELS[f]}
              </Link>
            ))}
          </div>
        </div>

        <TableShell>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead>Entregue em</TableHead>
                <TableHead>Lido em</TableHead>
                <TableHead>Reação</TableHead>
                <TableHead>Erro</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {recipients.length === 0 ? (
                <TableEmpty colSpan={7}>Nenhum destinatário nesse filtro.</TableEmpty>
              ) : (
                recipients.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.phone_e164}</TableCell>
                    <TableCell>
                      <StatusBadge tone={statusTone(r.status)}>
                        {RECIPIENT_STATUS_LABELS[r.status] ?? r.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-3">
                      {r.sent_at ? new Date(r.sent_at).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-3">
                      {r.delivered_at ? new Date(r.delivered_at).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-3">
                      {r.read_at ? new Date(r.read_at).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
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
                        <span className="text-ink-4">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-ink-3">{r.error_message ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <TableToolbar>
              <p>
                Página {page} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button asChild size="sm" variant="outline" disabled={page <= 1}>
                  <Link
                    href={`/comunicados/${dispatch.id}?status=${statusFilter}&page=${page - 1}`}
                  >
                    Anterior
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" disabled={page >= totalPages}>
                  <Link
                    href={`/comunicados/${dispatch.id}?status=${statusFilter}&page=${page + 1}`}
                  >
                    Próxima
                  </Link>
                </Button>
              </div>
            </TableToolbar>
          )}
        </TableShell>
      </div>
    </div>
  );
}
