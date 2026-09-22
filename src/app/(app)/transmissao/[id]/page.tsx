import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Copy, Download } from "lucide-react";

import { StageCard } from "@/components/stage-card";
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
import { BiggestLossCard } from "@/features/dashboard/biggest-loss-card";
import { DashboardTimeline } from "@/features/dashboard/dashboard-timeline";
import { DeliveryFunnel } from "@/features/dashboard/delivery-funnel";
import { ReadRateInfo } from "@/features/dashboard/read-rate-info";
import { buildFunnel, formatInt, formatPct, rate } from "@/lib/metrics/funnel";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  running: "Enviando",
  done: "Concluído",
  failed: "Falhou",
  canceled: "Cancelado",
};

/** Estado de UMA pessoa — exclusivo. "Enviada" aqui quer dizer "saiu, mas
 * ainda sem confirmação de entrega"; quem já entregou está em "Entregue". */
const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
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

export default async function TransmissaoDetalhe({
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

  // Um único funil alimenta toda a tela. Os status no banco são exclusivos
  // (quem leu não está em "entregue"), então acumular aqui é obrigatório —
  // antes cada card fazia essa conta por conta própria e eles divergiam.
  const funnel = buildFunnel(
    {
      queued: counts.queued ?? 0,
      sent: counts.sent ?? 0,
      delivered: counts.delivered ?? 0,
      read: counts.read ?? 0,
      failed: counts.failed ?? 0,
    },
    dispatch.total_recipients || 0,
    reactionCount,
  );
  const failedCount = funnel.failed;
  const ofPlanned = (n: number) => `${formatPct(rate(n, funnel.planned))} do total`;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/transmissao">
            <ChevronLeft className="size-4" /> Voltar
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-[23px] leading-tight font-semibold tracking-tight text-ink">
              {template?.name ?? "Transmissão"}
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
              <Link href={`/transmissao/nova?from=${dispatch.id}`}>
                <Copy className="size-4" /> Duplicar
              </Link>
            </Button>
            {totalRecipients > 0 && (
              <Button asChild size="sm" variant="outline">
                <a href={`/transmissao/${dispatch.id}/export`} download>
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

      {/* A jornada da mensagem, etapa por etapa. Cada card traz numerador,
          denominador e a conta pronta — nenhuma calculadora. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StageCard label="Programadas" value={funnel.planned} baseLabel="destinatários" />
        <StageCard
          label="Enviadas"
          value={funnel.sent}
          base={funnel.planned}
          baseLabel="do programado"
          tone="brand"
        />
        <StageCard
          label="Entregues"
          value={funnel.delivered}
          base={funnel.sent}
          baseLabel="das enviadas"
          secondary={ofPlanned(funnel.delivered)}
          tone="brand"
        />
        <StageCard
          label="Lidas"
          value={funnel.read}
          base={funnel.delivered}
          baseLabel="das entregues"
          secondary={ofPlanned(funnel.read)}
          tone="ok"
          hint={<ReadRateInfo />}
        />
        <StageCard
          label="Falharam"
          value={funnel.failed}
          base={funnel.planned}
          baseLabel="do programado"
          tone="danger"
        />
        <StageCard
          label="Pendentes"
          value={funnel.pending}
          base={funnel.planned}
          baseLabel="ainda na fila"
          tone="pending"
        />
        <StageCard
          label="Reações"
          value={funnel.reactions}
          base={funnel.delivered}
          baseLabel="das entregues"
          tone="violet"
        />
        <BiggestLossCard data={funnel} />
      </div>

      <div
        className={cn(
          "grid gap-4",
          timeline.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" : "",
        )}
      >
        <Card>
          <CardHeader>
            <CardTitle>Funil de entrega</CardTitle>
            <CardDescription>
              Do programado ao lido · o que se perdeu em cada etapa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeliveryFunnel data={funnel} emptyMessage="Sem destinatários." />
          </CardContent>
        </Card>

        {timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tendência</CardTitle>
              <CardDescription>Envios desta transmissão por dia</CardDescription>
            </CardHeader>
            <CardContent>
              <DashboardTimeline data={timeline} emptyMessage="Sem envios ainda." />
            </CardContent>
          </Card>
        )}
      </div>

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
                      {g.error_code || ""}
                    </TableCell>
                    <TableCell className="text-xs text-ink-2">{g.error_message || ""}</TableCell>
                    <TableCell className="num text-right text-[13px]">{g.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ink">Destinatários</h2>
          {/* Aqui os números são exclusivos de propósito: cada pessoa aparece
              uma vez, no estágio mais avançado que atingiu. Dizer isso em
              palavras evita a leitura errada de "só 11 foram enviadas". */}
          <p className="text-xs text-ink-2">
            Cada pessoa aparece uma vez, no estágio mais avançado que alcançou. Quem leu está em
            &quot;Lida&quot;, não em &quot;Entregue&quot;. Por isso estes números são menores que os
            dos cards acima, que são acumulados.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-2">
            {totalRecipients.toLocaleString("pt-BR")} nesta visão
          </p>
          <div className="flex flex-wrap items-center rounded-md border border-line-2 bg-card p-0.5">
            {(["all", "queued", "sent", "delivered", "read", "failed"] as const).map((f) => (
              <Link
                key={f}
                href={`/transmissao/${dispatch.id}?status=${f}`}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-[13px] font-medium transition-colors",
                  statusFilter === f
                    ? "bg-brand-soft text-brand-strong"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                {f === "all"
                  ? `Todos ${formatInt(funnel.planned)}`
                  : `${RECIPIENT_STATUS_LABELS[f]} ${formatInt(counts[f] ?? 0)}`}
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
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge tone={statusTone(r.status)}>
                          {RECIPIENT_STATUS_LABELS[r.status] ?? r.status}
                        </StatusBadge>
                        {/* Reenvio agendado: sem isso o destinatário parecia
                            parado "na fila" sem explicação. */}
                        {r.status === "queued" && r.attempts > 0 && (
                          <span className="text-[10px] whitespace-nowrap text-amber">
                            {r.attempts}ª tentativa
                            {r.next_attempt_at
                              ? ` · nova às ${new Date(r.next_attempt_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                              : ""}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-3">
                      {r.sent_at ? new Date(r.sent_at).toLocaleString("pt-BR") : ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-3">
                      {r.delivered_at ? new Date(r.delivered_at).toLocaleString("pt-BR") : ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-3">
                      {r.read_at ? new Date(r.read_at).toLocaleString("pt-BR") : ""}
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
                        null
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-ink-3">{r.error_message ?? ""}</TableCell>
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
                    href={`/transmissao/${dispatch.id}?status=${statusFilter}&page=${page - 1}`}
                  >
                    Anterior
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" disabled={page >= totalPages}>
                  <Link
                    href={`/transmissao/${dispatch.id}?status=${statusFilter}&page=${page + 1}`}
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
