"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Search } from "lucide-react";

import { StatusBadge, type StatusTone } from "@/components/status-badge";
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
import type { DispatchListItem } from "@/features/dispatch/actions";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  running: "Enviando",
  done: "Concluído",
  failed: "Falhou",
  canceled: "Cancelado",
};

function statusTone(status: string): StatusTone {
  switch (status) {
    case "done":
      return "ok";
    case "queued":
    case "running":
      return "pending";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

function initials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

type Filter = "all" | "done" | "running" | "failed";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "done", label: "Concluídos" },
  { value: "running", label: "Enviando" },
  { value: "failed", label: "Falhou" },
];

/** Filtro e busca são só de visualização sobre a lista já carregada — nenhuma
 * consulta nova. */
export function DispatchesTable({ dispatches }: { dispatches: DispatchListItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dispatches.filter((d) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "running"
            ? d.status === "running" || d.status === "queued"
            : d.status === filter;
      if (!matchesFilter) return false;
      if (!term) return true;
      return (
        (d.template_name ?? "").toLowerCase().includes(term) ||
        (d.segment_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [dispatches, filter, search]);

  // Mudou o filtro ou a busca, o conjunto é outro — voltar pra primeira página.
  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border border-line-2 bg-card p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-sm px-3 py-1 text-[13px] font-medium transition-colors",
                filter === f.value
                  ? "bg-brand-soft text-brand-strong"
                  : "text-ink-2 hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar template ou segmento"
            className="pl-8"
            aria-label="Buscar comunicado"
          />
        </div>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Template</TableHead>
              <TableHead>Segmentação</TableHead>
              <TableHead className="w-[180px]">Progresso</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Falhas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableEmpty colSpan={8}>Nenhum comunicado neste filtro.</TableEmpty>
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
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-card-2 text-[10px] font-semibold text-ink-2">
                          {initials(d.template_name ?? "")}
                        </span>
                        <Link
                          href={`/comunicados/${d.id}`}
                          className="truncate font-medium text-ink hover:text-brand hover:underline"
                        >
                          {d.template_name ?? "Sem template"}
                        </Link>
                      </div>
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
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex h-1.5 overflow-hidden rounded-full bg-card-2">
                          <div className="h-full bg-brand" style={{ width: `${sentPct}%` }} />
                          <div className="h-full bg-red" style={{ width: `${failPct}%` }} />
                        </div>
                        <p className="font-mono text-[11px] text-ink-3">
                          {sent.toLocaleString("pt-BR")} / {total.toLocaleString("pt-BR")} enviados
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="num text-right text-[13px]">
                      {total.toLocaleString("pt-BR")}
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
                    <TableCell className="font-mono text-xs whitespace-nowrap text-ink-3">
                      {new Date(d.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button asChild variant="ghost" size="icon-sm" title="Duplicar">
                          <Link href={`/comunicados/novo?from=${d.id}`}>
                            <Copy className="size-3.5" />
                          </Link>
                        </Button>
                      </div>
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
          unit="comunicados"
          onPageChange={setPage}
        />
      </TableShell>
    </div>
  );
}
