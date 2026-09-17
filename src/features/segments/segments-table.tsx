"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
import { deleteSegmentAction, type SegmentWithCount } from "@/features/segments/actions";
import { rulesSchema, type Rules } from "@/features/segments/schemas";
import type { Segment } from "@/lib/supabase/database.types";

type Props = {
  segments: SegmentWithCount[];
};

function parseRules(raw: Segment["rules"]): Rules | null {
  try {
    return rulesSchema.parse(raw);
  } catch {
    return null;
  }
}

function initials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

/** Busca é só de visualização sobre a lista já carregada — nenhuma consulta
 * nova. A paginação segue o mesmo passo das outras listagens. */
export function SegmentsTable({ segments }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return segments;
    return segments.filter((s) => s.name.toLowerCase().includes(term));
  }, [segments, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleDelete(s: Segment) {
    const fd = new FormData();
    fd.append("id", s.id);
    startTransition(async () => {
      const res = await deleteSegmentAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Segmento excluído");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative min-w-[240px] max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar segmento"
          className="pl-8"
          aria-label="Buscar segmento"
        />
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Contatos</TableHead>
              <TableHead>Regras</TableHead>
              <TableHead>Modo</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableEmpty colSpan={6}>Nenhum segmento encontrado.</TableEmpty>
            ) : (
              pageRows.map((s) => {
                const r = parseRules(s.rules);
                const count = r?.rules.length ?? 0;
                const match = r?.match ?? "and";
                return (
                  <TableRow key={s.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-card-2 text-[10px] font-semibold text-ink-2">
                          {initials(s.name)}
                        </span>
                        <Link
                          href={`/segmentos/${s.id}`}
                          className="truncate font-medium text-ink hover:text-brand hover:underline"
                        >
                          {s.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="num text-right text-[13px]">
                      {s.contact_count?.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs text-ink-2">
                      {count} regra{count === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="uppercase">
                        {match}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap text-ink-3">
                      {new Date(s.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button asChild variant="ghost" size="icon-sm" title="Editar">
                          <Link href={`/segmentos/${s.id}`}>
                            <Pencil className="size-3.5" />
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Excluir"
                              disabled={isPending}
                            >
                              <Trash2 className="text-destructive size-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir segmento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                &quot;{s.name}&quot; será removido. Comunicados que usam esse
                                segmento como referência continuam intactos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(s)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
          unit="segmentos"
          disabled={isPending}
          onPageChange={setPage}
        />
      </TableShell>
    </div>
  );
}
