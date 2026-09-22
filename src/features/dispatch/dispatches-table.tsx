"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Copy, History, Loader2, Pause, Pencil, Play, Search, Square } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge, type StatusTone } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { PAGE_SIZE, TablePager } from "@/components/table-pager";
import {
  cancelDispatchAction,
  pauseDispatchAction,
  resumeDispatchAction,
  type DispatchListItem,
} from "@/features/dispatch/actions";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  queued: "Na fila",
  running: "Enviando",
  paused: "Pausada",
  done: "Concluída",
  failed: "Falhou",
  canceled: "Cancelada",
};

function statusTone(status: string): StatusTone {
  switch (status) {
    case "done":
      return "ok";
    case "queued":
    case "running":
    case "scheduled":
      return "pending";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

/** Abas do topo, na mesma divisão do BotConversa. */
type Tab = "active" | "drafts" | "history";

const TABS: { value: Tab; label: string; icon: typeof CalendarClock }[] = [
  { value: "active", label: "Ativas e agendadas", icon: CalendarClock },
  { value: "drafts", label: "Rascunhos", icon: Pencil },
  { value: "history", label: "Histórico", icon: History },
];

const ACTIVE_STATUSES = ["scheduled", "queued", "running", "paused"];
const HISTORY_STATUSES = ["done", "failed", "canceled"];

function broadcastName(d: DispatchListItem): string {
  return d.name || d.campaign_name || d.template_name || "Transmissão";
}

function scheduleLabel(d: DispatchListItem): string {
  if (d.scheduled_at) {
    return new Date(d.scheduled_at).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (d.status === "running" || d.status === "queued") return "Agora";
  return "—";
}

function RowActions({ dispatch }: { dispatch: DispatchListItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stopping, setStopping] = useState(false);

  const canPause = ["scheduled", "queued", "running"].includes(dispatch.status);
  const canResume = dispatch.status === "paused";
  const canStop = ["draft", "scheduled", "queued", "running", "paused"].includes(dispatch.status);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = (await fn()) as { ok: boolean; error?: string };
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Não foi possível");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      {canPause && (
        <Button
          variant="ghost"
          size="icon-sm"
          title="Pausar"
          aria-label="Pausar transmissão"
          disabled={isPending}
          onClick={() => run(() => pauseDispatchAction(dispatch.id), "Transmissão pausada")}
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Pause className="size-3.5" />}
        </Button>
      )}
      {canResume && (
        <Button
          variant="ghost"
          size="icon-sm"
          title="Retomar"
          aria-label="Retomar transmissão"
          disabled={isPending}
          onClick={() => run(() => resumeDispatchAction(dispatch.id), "Transmissão retomada")}
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
        </Button>
      )}
      {canStop && (
        <Button
          variant="ghost"
          size="icon-sm"
          title="Parar"
          aria-label="Parar transmissão"
          className="text-destructive"
          disabled={isPending}
          onClick={() => setStopping(true)}
        >
          <Square className="size-3.5" />
        </Button>
      )}
      <Button asChild variant="ghost" size="icon-sm" title="Duplicar">
        <Link href={`/transmissao/nova?from=${dispatch.id}`}>
          <Copy className="size-3.5" />
        </Link>
      </Button>

      <AlertDialog open={stopping} onOpenChange={setStopping}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Parar esta transmissão?</AlertDialogTitle>
            <AlertDialogDescription>
              O que já saiu continua entregue. O que ainda está na fila não sai mais, e isso não
              tem volta — pra retomar depois, use Pausar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                run(() => cancelDispatchAction(dispatch.id), "Transmissão parada");
                setStopping(false);
              }}
            >
              Parar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Filtro, busca e abas são só de visualização sobre a lista já carregada —
 * nenhuma consulta nova. */
export function DispatchesTable({ dispatches }: { dispatches: DispatchListItem[] }) {
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const counts = useMemo(
    () => ({
      active: dispatches.filter((d) => ACTIVE_STATUSES.includes(d.status)).length,
      drafts: dispatches.filter((d) => d.status === "draft").length,
      history: dispatches.filter((d) => HISTORY_STATUSES.includes(d.status)).length,
    }),
    [dispatches],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dispatches.filter((d) => {
      const inTab =
        tab === "active"
          ? ACTIVE_STATUSES.includes(d.status)
          : tab === "drafts"
            ? d.status === "draft"
            : HISTORY_STATUSES.includes(d.status);
      if (!inTab) return false;
      if (!term) return true;
      return (
        broadcastName(d).toLowerCase().includes(term) ||
        (d.campaign_name ?? "").toLowerCase().includes(term) ||
        (d.template_name ?? "").toLowerCase().includes(term) ||
        (d.segment_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [dispatches, tab, search]);

  // Mudou a aba ou a busca, o conjunto é outro — voltar pra primeira página.
  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border border-line-2 bg-card p-0.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-3 py-1 text-[13px] font-medium transition-colors",
                  tab === t.value ? "bg-brand-soft text-brand-strong" : "text-ink-2 hover:text-ink",
                )}
              >
                <Icon className="size-3.5" /> {t.label}
                <span className="num text-[11px] text-ink-3">{counts[t.value]}</span>
              </button>
            );
          })}
        </div>
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, campanha ou segmento"
            className="pl-8"
            aria-label="Buscar transmissão"
          />
        </div>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Nome</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead>Segmentação</TableHead>
              <TableHead>Agendar para</TableHead>
              <TableHead className="w-[170px]">Progresso</TableHead>
              <TableHead className="text-right">Enviado</TableHead>
              <TableHead className="text-right">Falha</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableEmpty colSpan={9}>Nenhuma transmissão nesta aba.</TableEmpty>
            ) : (
              pageRows.map((d) => {
                const sent =
                  (d.counts.sent ?? 0) + (d.counts.delivered ?? 0) + (d.counts.read ?? 0);
                const failed = d.counts.failed ?? 0;
                const total = d.total_recipients || 0;
                const sentPct = total > 0 ? (sent / total) * 100 : 0;
                const failPct = total > 0 ? (failed / total) * 100 : 0;
                return (
                  <TableRow key={d.id} className="group">
                    <TableCell>
                      <Link
                        href={`/transmissao/${d.id}`}
                        className="truncate font-medium text-ink hover:text-brand hover:underline"
                      >
                        {broadcastName(d)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {d.campaign_name ? (
                        <Badge variant="info">{d.campaign_name}</Badge>
                      ) : (
                        <span className="text-xs text-ink-4">Avulsa</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.recipient_source === "segment" ? (
                        d.segment_name ? (
                          <Badge variant="secondary">{d.segment_name}</Badge>
                        ) : (
                          <span className="text-xs text-ink-4">Segmento removido</span>
                        )
                      ) : (
                        <Badge variant="outline">Lista manual</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap text-ink-3">
                      {scheduleLabel(d)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex h-1.5 overflow-hidden rounded-full bg-card-2">
                          <div className="h-full bg-brand" style={{ width: `${sentPct}%` }} />
                          <div className="h-full bg-red" style={{ width: `${failPct}%` }} />
                        </div>
                        <p className="font-mono text-[11px] text-ink-3">
                          {sent.toLocaleString("pt-BR")} / {total.toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="num text-right text-[13px]">
                      {sent.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell
                      className={cn("num text-right text-[13px]", failed > 0 && "text-red")}
                    >
                      {failed.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={statusTone(d.status)}>
                        {STATUS_LABELS[d.status] ?? d.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <RowActions dispatch={d} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePager
          page={page}
          pageSize={PAGE_SIZE}
          total={rows.length}
          unit="transmissões"
          onPageChange={setPage}
        />
      </TableShell>
    </div>
  );
}
