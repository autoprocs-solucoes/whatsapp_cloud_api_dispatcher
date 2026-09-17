import * as React from "react";

import { cn } from "@/lib/utils";

/** Casca da tabela: card branco, borda hairline, cantos 8px. */
function TableShell({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-shell"
      className={cn("overflow-hidden rounded-lg border border-line bg-card shadow-card", className)}
      {...props}
    />
  );
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full border-collapse text-[13px]", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-card-2 [&_tr]:border-b [&_tr]:border-line", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-line transition-colors last:border-0 hover:bg-card-2",
        className,
      )}
      {...props}
    />
  );
}

/** Célula de cabeçalho: caixa-alta pequena com tracking, em cinza médio. */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn("label-caps px-3 py-2.5 text-left whitespace-nowrap", className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-3 py-2.5 align-middle text-ink", className)}
      {...props}
    />
  );
}

/** Rodapé fora da tabela (contagem + paginação), separado por hairline. */
function TableToolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-toolbar"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-line bg-card px-3 py-2.5 text-xs text-ink-3",
        className,
      )}
      {...props}
    />
  );
}

function TableEmpty({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center text-sm text-ink-3">
        {children}
      </td>
    </tr>
  );
}

export {
  TableShell,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableToolbar,
  TableEmpty,
};
