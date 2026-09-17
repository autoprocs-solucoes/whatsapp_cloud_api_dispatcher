"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableToolbar } from "@/components/ui/table";

/** Itens por página nas listagens (contatos, segmentos, comunicados). */
export const PAGE_SIZE = 10;

type Props = {
  /** Página atual, começando em 1. */
  page: number;
  pageSize: number;
  /** Total de itens depois dos filtros. */
  total: number;
  /** Plural do que está sendo listado: "contatos", "comunicados", "segmentos". */
  unit: string;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

/**
 * Rodapé de paginação das listagens. É só apresentação — quem chama decide se a
 * página vive na URL (servidor) ou em estado local (filtro em memória).
 */
export function TablePager({ page, pageSize, total, unit, onPageChange, disabled }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <TableToolbar>
      <p>
        {total === 0 ? (
          `Nenhum ${unit.replace(/s$/, "")}`
        ) : (
          <>
            Mostrando{" "}
            <span className="num text-ink-2">
              {first.toLocaleString("pt-BR")}–{last.toLocaleString("pt-BR")}
            </span>{" "}
            de <span className="num text-ink-2">{total.toLocaleString("pt-BR")}</span> {unit}
          </>
        )}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || disabled}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-3.5" /> Anterior
          </Button>
          <span className="num px-2 text-ink-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || disabled}
            onClick={() => onPageChange(page + 1)}
          >
            Próxima <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}
    </TableToolbar>
  );
}
