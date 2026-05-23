"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  Pencil,
  Search,
  Trash2,
  UserX,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { parseCustomFields } from "@/features/contacts/custom-fields";
import { EditContactDialog } from "@/features/contacts/edit-contact-dialog";
import { cn } from "@/lib/utils";
import { deleteContactAction, toggleOptOutAction } from "@/features/contacts/actions";
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

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const optOutFilter = (searchParams.get("optOutFilter") ?? "all") as "all" | "active" | "opt_out";

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
  const visibleColCount = allColumns.filter((c) => isVisible(c.key)).length + 1;

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
        <div className="flex gap-1">
          {(["all", "active", "opt_out"] as const).map((f) => (
            <Button
              key={f}
              type="button"
              variant={optOutFilter === f ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams({ optOutFilter: f === "all" ? null : f, page: "1" })}
            >
              {f === "all" ? "Todos" : f === "active" ? "Ativos" : "Opt-out"}
            </Button>
          ))}
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

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              {isVisible("full_name") && (
                <th className="px-3 py-2 text-left font-medium">Nome</th>
              )}
              {isVisible("phone_e164") && (
                <th className="px-3 py-2 text-left font-medium">Telefone</th>
              )}
              {isVisible("tags") && (
                <th className="px-3 py-2 text-left font-medium">Tags</th>
              )}
              {isVisible("opt_out") && (
                <th className="px-3 py-2 text-left font-medium">Status</th>
              )}
              {isVisible("created_at") && (
                <th className="px-3 py-2 text-left font-medium">Criado em</th>
              )}
              {customColumns.map(
                (col) =>
                  isVisible(col.key) && (
                    <th
                      key={col.key}
                      className="px-3 py-2 text-left font-medium"
                      title={col.label}
                    >
                      {col.label}
                    </th>
                  ),
              )}
              <th className="px-3 py-2 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={visibleColCount} className="text-muted-foreground px-3 py-8 text-center">
                  Nenhum contato encontrado.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className={cn("border-t", c.opt_out && "opacity-60")}>
                  {isVisible("full_name") && (
                    <td className="px-3 py-2">{c.full_name ?? "—"}</td>
                  )}
                  {isVisible("phone_e164") && (
                    <td className="px-3 py-2 font-mono text-xs">{c.phone_e164}</td>
                  )}
                  {isVisible("tags") && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.length === 0 ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          c.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px]">
                              {t}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                  )}
                  {isVisible("opt_out") && (
                    <td className="px-3 py-2">
                      {c.opt_out ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Opt-out
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px]">
                          Ativo
                        </Badge>
                      )}
                    </td>
                  )}
                  {isVisible("created_at") && (
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  )}
                  {customColumns.map((col) => {
                    if (!isVisible(col.key)) return null;
                    const cf = parseCustomFields(c.custom_fields);
                    const val = cf[col.label];
                    return (
                      <td key={col.key} className="px-3 py-2 text-xs">
                        {val ? val : <span className="text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs">
        <p className="text-muted-foreground">
          {total} contato(s) · página {page} de {totalPages}
        </p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isPending}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isPending}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <EditContactDialog
        contact={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}
