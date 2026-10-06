"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableToolbar } from "@/components/ui/table";

/** Itens por página nas listagens (contatos, segmentos, transmissões). */
export const PAGE_SIZE = 10;

type Props = {
  /** Página atual, começando em 1. */
  page: number;
  pageSize: number;
  /** Total de itens depois dos filtros. */
  total: number;
  /** Plural do que está sendo listado: "contatos", "transmissões", "segmentos". */
  unit: string;
  /** Listagem que pagina em memória: troca de página sem sair da tela. */
  onPageChange?: (page: number) => void;
  /**
   * Listagem que pagina no servidor: devolve o endereço de cada página e os
   * controles viram links de verdade.
   *
   * Tem motivo pra não ser navegação do Next: com o caminho igual e só o
   * `?page=` mudando, ele reaproveitava a tela já renderizada e a lista
   * congelava numa página enquanto a URL avançava. Link comum não tem como
   * mostrar coisa diferente do que o servidor respondeu.
   */
  hrefFor?: (page: number) => string;
  disabled?: boolean;
};

/**
 * Rodapé de paginação das listagens. É só apresentação — quem chama decide se a
 * página vive na URL (servidor) ou em estado local (filtro em memória).
 */
export function TablePager({
  page,
  pageSize,
  total,
  unit,
  onPageChange,
  hrefFor,
  disabled,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  function control(destino: number, bloqueado: boolean, conteudo: React.ReactNode) {
    if (hrefFor && !bloqueado) {
      return (
        <Button variant="outline" size="sm" asChild>
          <a href={hrefFor(destino)}>{conteudo}</a>
        </Button>
      );
    }
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={bloqueado}
        onClick={() => onPageChange?.(destino)}
      >
        {conteudo}
      </Button>
    );
  }

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
          {control(
            page - 1,
            page <= 1 || Boolean(disabled),
            <>
              <ChevronLeft className="size-3.5" /> Anterior
            </>,
          )}
          <span className="num px-2 text-ink-2">
            {page} / {totalPages}
          </span>
          {control(
            page + 1,
            page >= totalPages || Boolean(disabled),
            <>
              Próxima <ChevronRight className="size-3.5" />
            </>,
          )}
        </div>
      )}
    </TableToolbar>
  );
}
