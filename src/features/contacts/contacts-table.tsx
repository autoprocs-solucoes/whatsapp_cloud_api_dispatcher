"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Columns3, ListFilter, Pencil, Search, Trash2, UserX } from "lucide-react";
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
import { StatusBadge } from "@/components/status-badge";
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
import { TablePager } from "@/components/table-pager";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { parseCustomFields } from "@/features/contacts/custom-fields";
import { EditContactDialog } from "@/features/contacts/edit-contact-dialog";
import { cn } from "@/lib/utils";
import {
  bulkDeleteContactsAction,
  deleteAllMatchingAction,
  deleteContactAction,
  toggleOptOutAction,
} from "@/features/contacts/actions";
import type { Contact } from "@/lib/supabase/database.types";

type ColumnDef = { key: string; label: string; group: "base" | "custom" };

const BASE_COLUMNS: ColumnDef[] = [
  { key: "full_name", label: "Nome", group: "base" },
  { key: "phone_e164", label: "Telefone", group: "base" },
  { key: "tags", label: "Tags", group: "base" },
  { key: "opt_out", label: "Status", group: "base" },
  { key: "created_at", label: "Criado em", group: "base" },
];

const LOCKED_COLUMN = "phone_e164";
const STORAGE_KEY = "contacts-table-visible-columns";

const OPT_OUT_LABELS: Record<"all" | "active" | "opt_out", string> = {
  all: "Todos",
  active: "Ativos",
  opt_out: "Opt-out",
};

type Props = {
  contacts: Contact[];
  total: number;
  page: number;
  pageSize: number;
};

export function ContactsTable({ contacts, total, page, pageSize }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Contact | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const appliedSearch = searchParams.get("search") ?? "";
  const optOutFilter = (searchParams.get("optOutFilter") ?? "all") as "all" | "active" | "opt_out";

  useEffect(() => {
    setSelected(new Set());
    setSelectAllMatching(false);
  }, [contacts]);

  function toggleSelectAll(checked: boolean) {
    setSelectAllMatching(false);
    setSelected(checked ? new Set(contacts.map((c) => c.id)) : new Set());
  }

  function toggleSelectOne(id: string, checked: boolean) {
    setSelectAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  const someSelected = selected.size > 0 && !allSelected;
  const selectedCount = selectAllMatching ? total : selected.size;

  function handleClearSelection() {
    setSelected(new Set());
    setSelectAllMatching(false);
  }

  function handleBulkDelete() {
    if (selectAllMatching) {
      const fd = new FormData();
      fd.append("search", appliedSearch);
      fd.append("optOutFilter", optOutFilter);
      startTransition(async () => {
        const res = await deleteAllMatchingAction(fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(`${res.data.deleted} contato(s) excluído(s)`);
        handleClearSelection();
        router.refresh();
      });
      return;
    }

    const ids = Array.from(selected);
    const fd = new FormData();
    fd.append("ids", JSON.stringify(ids));
    startTransition(async () => {
      const res = await bulkDeleteContactsAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.data.deleted} contato(s) excluído(s)`);
      handleClearSelection();
      router.refresh();
    });
  }

  const customColumns = useMemo<ColumnDef[]>(() => {
    const keys = new Set<string>();
    contacts.forEach((c) => {
      const cf = parseCustomFields(c.custom_fields);
      Object.keys(cf).forEach((k) => keys.add(k));
    });
    return Array.from(keys)
      .sort()
      .map((k) => ({ key: `cf:${k}`, label: k, group: "custom" as const }));
  }, [contacts]);

  const allColumns = useMemo(() => [...BASE_COLUMNS, ...customColumns], [customColumns]);

  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(BASE_COLUMNS.map((c) => c.key)),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) {
          const next = new Set(arr.filter((v): v is string => typeof v === "string"));
          next.add(LOCKED_COLUMN);
          setVisible(next);
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visible)));
    } catch {
      // ignore
    }
  }, [visible, hydrated]);

  function toggleColumn(key: string, checked: boolean) {
    if (key === LOCKED_COLUMN) return;
    setVisible((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  const isVisible = (key: string) => visible.has(key);
  const visibleColCount = allColumns.filter((c) => isVisible(c.key)).length + 2;

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    });
    router.push(`/contatos?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ search: searchInput, page: "1" });
  }

  function handleToggleOptOut(c: Contact) {
    const fd = new FormData();
    fd.append("id", c.id);
    fd.append("opt_out", String(!c.opt_out));
    startTransition(async () => {
      const res = await toggleOptOutAction(fd);
      if (!res.ok) toast.error(res.error);
      else toast.success(c.opt_out ? "Opt-out removido" : "Marcado como opt-out");
    });
  }

  function handleDelete(c: Contact) {
    const fd = new FormData();
    fd.append("id", c.id);
    startTransition(async () => {
      const res = await deleteContactAction(fd);
      if (!res.ok) toast.error(res.error);
      else toast.success("Contato excluído");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              type="search"
              placeholder="Buscar por nome ou telefone"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
        <div className="flex flex-wrap gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant={optOutFilter === "all" ? "outline" : "default"}
                size="sm"
              >
                <ListFilter className="mr-1 size-3.5" />
                Status: {OPT_OUT_LABELS[optOutFilter]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={optOutFilter}
                onValueChange={(v) =>
                  updateParams({ optOutFilter: v === "all" ? null : v, page: "1" })
                }
              >
                {(["all", "active", "opt_out"] as const).map((f) => (
                  <DropdownMenuRadioItem key={f} value={f}>
                    {OPT_OUT_LABELS[f]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Columns3 className="mr-1 size-3.5" /> Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Colunas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {BASE_COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={isVisible(col.key)}
                  disabled={col.key === LOCKED_COLUMN}
                  onCheckedChange={(v) => toggleColumn(col.key, Boolean(v))}
                  onSelect={(e) => e.preventDefault()}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
              {customColumns.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-muted-foreground text-xs">
                    Campos custom
                  </DropdownMenuLabel>
                  {customColumns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={isVisible(col.key)}
                      onCheckedChange={(v) => toggleColumn(col.key, Boolean(v))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bg-muted/40 flex flex-col gap-2 rounded-md border px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              {selectedCount} contato(s) selecionado(s)
              {selectAllMatching && " (todos os que batem com o filtro atual)"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                disabled={isPending}
              >
                Limpar seleção
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isPending}>
                    <Trash2 className="mr-1 size-3.5" /> Excluir selecionados
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {selectedCount} contato(s)?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Essa ação não pode ser desfeita. Histórico de disparos não é afetado.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          {!selectAllMatching && allSelected && total > contacts.length && (
            <button
              type="button"
              onClick={() => setSelectAllMatching(true)}
              className="text-primary text-left text-xs underline underline-offset-2"
            >
              Todos os {contacts.length} desta página estão selecionados. Selecionar os{" "}
              {total} contatos que batem com o filtro atual?
            </button>
          )}
        </div>
      )}

      <TableShell>
        <Table>
          <TableHeader>
            <tr>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--brand)]"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              {isVisible("full_name") && <TableHead>Nome</TableHead>}
              {isVisible("phone_e164") && <TableHead>Telefone</TableHead>}
              {isVisible("tags") && <TableHead>Tags</TableHead>}
              {isVisible("opt_out") && <TableHead>Status</TableHead>}
              {isVisible("created_at") && <TableHead>Criado em</TableHead>}
              {customColumns.map(
                (col) =>
                  isVisible(col.key) && (
                    <TableHead key={col.key} title={col.label}>
                      {col.label}
                    </TableHead>
                  ),
              )}
              <TableHead className="text-right">Ações</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableEmpty colSpan={visibleColCount}>Nenhum contato encontrado.</TableEmpty>
            ) : (
              contacts.map((c) => (
                <TableRow key={c.id} className={cn("group", c.opt_out && "opacity-60")}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--brand)]"
                      checked={selected.has(c.id)}
                      onChange={(e) => toggleSelectOne(c.id, e.target.checked)}
                      aria-label={`Selecionar ${c.phone_e164}`}
                    />
                  </TableCell>
                  {isVisible("full_name") && (
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-card-2 text-[10px] font-semibold text-ink-2">
                          {(c.full_name ?? c.phone_e164)
                            .split(/\s+/)
                            .map((p) => p[0]?.toUpperCase() ?? "")
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">
                            {c.full_name ?? "—"}
                          </span>
                        </span>
                      </div>
                    </TableCell>
                  )}
                  {isVisible("phone_e164") && (
                    <TableCell className="font-mono text-xs text-ink-2">{c.phone_e164}</TableCell>
                  )}
                  {isVisible("tags") && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.length === 0 ? (
                          <span className="text-xs text-ink-4">—</span>
                        ) : (
                          c.tags.map((t) => (
                            <Badge key={t} variant="secondary">
                              {t}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isVisible("opt_out") && (
                    <TableCell>
                      {c.opt_out ? (
                        <StatusBadge tone="danger">Opt-out</StatusBadge>
                      ) : (
                        <StatusBadge tone="ok">Ativo</StatusBadge>
                      )}
                    </TableCell>
                  )}
                  {isVisible("created_at") && (
                    <TableCell className="font-mono text-xs text-ink-3">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  )}
                  {customColumns.map((col) => {
                    if (!isVisible(col.key)) return null;
                    const cf = parseCustomFields(c.custom_fields);
                    const val = cf[col.label];
                    return (
                      <TableCell key={col.key} className="text-xs text-ink-2">
                        {val ? val : <span className="text-ink-4">—</span>}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(c)}
                        title="Editar"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" title="Toggle opt-out">
                            <UserX className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {c.opt_out ? "Remover opt-out?" : "Marcar como opt-out?"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {c.opt_out
                                ? `${c.phone_e164} voltará a receber comunicados.`
                                : `${c.phone_e164} não receberá mais nenhum comunicado.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleToggleOptOut(c)}>
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" title="Excluir">
                            <Trash2 className="text-destructive size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {c.phone_e164} será removido permanentemente. Histórico de
                              disparos não é afetado.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(c)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePager
          page={page}
          pageSize={pageSize}
          total={total}
          unit="contatos"
          disabled={isPending}
          onPageChange={(next) => updateParams({ page: String(next) })}
        />
      </TableShell>

      <EditContactDialog
        contact={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}
