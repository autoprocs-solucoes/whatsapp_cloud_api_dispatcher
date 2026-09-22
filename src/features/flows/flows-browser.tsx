"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Copy,
  Folder,
  FolderPlus,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createFlowAction,
  createFlowFromPresetAction,
  createFolderAction,
  deleteFlowAction,
  deleteFolderAction,
  duplicateFlowAction,
  moveFlowAction,
  renameFlowAction,
  renameFolderAction,
} from "@/features/flows/actions";
import { FLOW_PRESETS } from "@/features/flows/presets";
import type { FlowSummary } from "@/server/flows";
import type { FlowFolder } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Props = {
  folders: FlowFolder[];
  flows: FlowSummary[];
};

type NameDialog =
  | { mode: "new-folder" }
  | { mode: "new-flow"; folderId: string | null }
  | { mode: "rename-folder"; id: string; current: string }
  | { mode: "rename-flow"; id: string; current: string }
  | null;

function FlowCard({
  flow,
  folders,
  onOpen,
  onAction,
}: {
  flow: FlowSummary;
  folders: FlowFolder[];
  onOpen: () => void;
  onAction: (action: NameDialog | { mode: "delete-flow"; id: string }) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateFlowAction(flow.id);
      if (result.ok) {
        toast.success("Fluxo duplicado");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function move(folderId: string | null) {
    startTransition(async () => {
      const result = await moveFlowAction({ flowId: flow.id, folderId });
      if (result.ok) {
        toast.success("Fluxo movido");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="group flex flex-col rounded-lg border border-line bg-card shadow-card transition-colors hover:border-line-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-2.5 p-3 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Workflow className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{flow.name}</span>
          <span className="mt-0.5 block text-[11px] text-ink-3">
            {flow.stepCount} bloco{flow.stepCount === 1 ? "" : "s"} · atualizado{" "}
            {new Date(flow.updatedAt).toLocaleDateString("pt-BR")}
          </span>
        </span>
      </button>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <StatusBadge tone={flow.status === "published" ? "ok" : "pending"}>
          {flow.status === "published" ? "Publicado" : "Rascunho"}
        </StatusBadge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Ações do fluxo" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <MoreVertical className="size-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => onAction({ mode: "rename-flow", id: flow.id, current: flow.name })}
            >
              <Pencil className="size-3.5" /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={duplicate}>
              <Copy className="size-3.5" /> Duplicar
            </DropdownMenuItem>
            {folders.length > 0 && <DropdownMenuSeparator />}
            {folders.map((f) => (
              <DropdownMenuItem
                key={f.id}
                disabled={f.id === flow.folderId}
                onClick={() => move(f.id)}
              >
                <Folder className="size-3.5" /> Mover pra {f.name}
              </DropdownMenuItem>
            ))}
            {flow.folderId && (
              <DropdownMenuItem onClick={() => move(null)}>
                <ChevronLeft className="size-3.5" /> Tirar da pasta
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onAction({ mode: "delete-flow", id: flow.id })}
            >
              <Trash2 className="size-3.5" /> Apagar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function FlowsBrowser({ folders, flows }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<NameDialog>(null);
  const [deleting, setDeleting] = useState<{ kind: "flow" | "folder"; id: string } | null>(null);
  const [nameValue, setNameValue] = useState("");

  const openFolder = folders.find((f) => f.id === openFolderId) ?? null;

  const visibleFlows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return flows.filter((f) => {
      if (term) return f.name.toLowerCase().includes(term);
      return f.folderId === (openFolder?.id ?? null);
    });
  }, [flows, search, openFolder]);

  const countByFolder = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of flows) {
      if (!f.folderId) continue;
      map.set(f.folderId, (map.get(f.folderId) ?? 0) + 1);
    }
    return map;
  }, [flows]);

  function openDialog(next: NameDialog | { mode: "delete-flow"; id: string }) {
    if (next && next.mode === "delete-flow") {
      setDeleting({ kind: "flow", id: next.id });
      return;
    }
    setDialog(next);
    setNameValue(next && "current" in next ? next.current : "");
  }

  function submitName() {
    if (!dialog) return;
    const name = nameValue.trim();
    if (!name) {
      toast.error("Dê um nome");
      return;
    }

    startTransition(async () => {
      if (dialog.mode === "new-folder") {
        const r = await createFolderAction({ name });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        toast.success("Pasta criada");
      } else if (dialog.mode === "new-flow") {
        const r = await createFlowAction({ name, folderId: dialog.folderId });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setDialog(null);
        router.push(`/fluxos/${r.data.id}`);
        return;
      } else if (dialog.mode === "rename-folder") {
        const r = await renameFolderAction({ id: dialog.id, name });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        toast.success("Pasta renomeada");
      } else {
        const r = await renameFlowAction({ id: dialog.id, name });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        toast.success("Fluxo renomeado");
      }
      setDialog(null);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const r =
        deleting.kind === "flow"
          ? await deleteFlowAction(deleting.id)
          : await deleteFolderAction(deleting.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(deleting.kind === "flow" ? "Fluxo apagado" : "Pasta apagada");
      if (deleting.kind === "folder" && deleting.id === openFolderId) setOpenFolderId(null);
      setDeleting(null);
      router.refresh();
    });
  }

  function createFromPreset(key: string) {
    startTransition(async () => {
      const r = await createFlowFromPresetAction(key);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      router.push(`/fluxos/${r.data.id}`);
    });
  }

  return (
    <div className="space-y-5">
      {/* Atalhos que já entregam o fluxo desenhado — a pessoa só ajusta o texto. */}
      {!openFolder && !search && (
        <section className="space-y-2">
          <h2 className="label-caps">Fluxos padrões básicos</h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {FLOW_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                disabled={isPending}
                onClick={() => createFromPreset(p.key)}
                className="rounded-lg border border-dashed border-line-2 px-3 py-4 text-sm font-medium text-ink-2 transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {openFolder && (
          <Button variant="ghost" size="sm" onClick={() => setOpenFolderId(null)}>
            <ChevronLeft className="size-4" /> Todos os fluxos
          </Button>
        )}
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fluxo"
            className="pl-8"
            aria-label="Buscar fluxo"
          />
        </div>
        <Button variant="outline" onClick={() => openDialog({ mode: "new-folder" })}>
          <FolderPlus className="size-4" /> Criar pasta
        </Button>
        <Button
          onClick={() => openDialog({ mode: "new-flow", folderId: openFolder?.id ?? null })}
        >
          <Plus className="size-4" /> Criar novo fluxo
        </Button>
      </div>

      {!openFolder && !search && folders.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {folders.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2.5 shadow-card transition-colors hover:border-line-3"
            >
              <button
                type="button"
                onClick={() => setOpenFolderId(f.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Folder className="size-4 shrink-0 text-ink-3" />
                <span className="truncate text-sm font-medium text-ink">{f.name}</span>
                <span className="num text-xs text-ink-3">{countByFolder.get(f.id) ?? 0}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Ações da pasta">
                    <MoreVertical className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      openDialog({ mode: "rename-folder", id: f.id, current: f.name })
                    }
                  >
                    <Pencil className="size-3.5" /> Renomear
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleting({ kind: "folder", id: f.id })}
                  >
                    <Trash2 className="size-3.5" /> Apagar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="label-caps">
          {search ? "Resultados" : openFolder ? openFolder.name : "Todos os fluxos"}
        </h2>
        {visibleFlows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-2 py-12 text-center">
            <p className="text-sm text-ink-2">
              {search ? "Nenhum fluxo com esse nome." : "Nenhum fluxo por aqui ainda."}
            </p>
          </div>
        ) : (
          <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3")}>
            {visibleFlows.map((flow) => (
              <FlowCard
                key={flow.id}
                flow={flow}
                folders={folders}
                onOpen={() => router.push(`/fluxos/${flow.id}`)}
                onAction={openDialog}
              />
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog?.mode === "new-folder"
                ? "Nova pasta"
                : dialog?.mode === "new-flow"
                  ? "Novo fluxo"
                  : "Renomear"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.mode === "new-flow"
                ? "O fluxo abre no editor logo depois de criado."
                : "Escolha um nome curto, que se entenda na lista."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="flow-name">Nome</Label>
            <Input
              id="flow-name"
              value={nameValue}
              autoFocus
              maxLength={80}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitName();
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button onClick={submitName} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />} Salvar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleting?.kind === "flow" ? "Apagar fluxo?" : "Apagar pasta?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.kind === "flow"
                ? "O desenho some junto. Transmissões que usam esse fluxo param de encontrar o conteúdo."
                : "Os fluxos de dentro não são apagados — eles voltam pra lista solta."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />} Apagar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
