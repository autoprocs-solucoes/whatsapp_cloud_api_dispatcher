"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Layers,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Send,
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
  createCampaignAction,
  deleteCampaignAction,
  setCampaignStatusAction,
  updateCampaignAction,
} from "@/features/campaigns/actions";
import type { CampaignRow } from "@/server/campaigns";
import { cn } from "@/lib/utils";

type FlowOption = { id: string; name: string; status: "draft" | "published" };

type Props = {
  campaigns: CampaignRow[];
  flows: FlowOption[];
};

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; campaign: CampaignRow }
  | null;

export function CampaignsGrid({ campaigns, flows }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleting, setDeleting] = useState<CampaignRow | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [flowId, setFlowId] = useState("");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (!showArchived && c.status === "archived") return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.description ?? "").toLowerCase().includes(term) ||
        (c.templateName ?? "").toLowerCase().includes(term)
      );
    });
  }, [campaigns, search, showArchived]);

  function openEditor(state: EditorState) {
    setEditor(state);
    if (state?.mode === "edit") {
      setName(state.campaign.name);
      setDescription(state.campaign.description ?? "");
      setFlowId(state.campaign.flowId ?? "");
    } else {
      setName("");
      setDescription("");
      setFlowId("");
    }
  }

  function submit() {
    if (!editor) return;
    const payload = { name, description, flowId: flowId || null };

    startTransition(async () => {
      const result =
        editor.mode === "create"
          ? await createCampaignAction(payload)
          : await updateCampaignAction({ ...payload, id: editor.campaign.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editor.mode === "create" ? "Campanha criada" : "Campanha salva");
      setEditor(null);
      router.refresh();
    });
  }

  function toggleArchive(campaign: CampaignRow) {
    startTransition(async () => {
      const result = await setCampaignStatusAction(
        campaign.id,
        campaign.status === "archived" ? "active" : "archived",
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(campaign.status === "archived" ? "Campanha reativada" : "Campanha arquivada");
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteCampaignAction(deleting.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Campanha apagada");
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar campanha"
            className="pl-8"
            aria-label="Buscar campanha"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors",
            showArchived
              ? "border-brand bg-brand-soft text-brand-strong"
              : "border-line-2 bg-card text-ink-2 hover:text-ink",
          )}
        >
          Mostrar arquivadas
        </button>
        <Button onClick={() => openEditor({ mode: "create" })}>
          <Plus className="size-4" /> Criar nova campanha
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-2 py-16 text-center">
          <p className="text-sm text-ink-2">
            {search ? "Nenhuma campanha com esse nome." : "Você ainda não tem nenhuma campanha."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <div
              key={c.id}
              className="flex flex-col rounded-lg border border-line bg-card shadow-card transition-colors hover:border-line-3"
            >
              <div className="flex items-start justify-between gap-2 border-b border-line p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                    <Layers className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                    <p className="truncate text-[11px] text-ink-3">
                      {c.description || "Sem descrição"}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Ações da campanha">
                      <MoreVertical className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => openEditor({ mode: "edit", campaign: c })}>
                      <Pencil className="size-3.5" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleArchive(c)}>
                      {c.status === "archived" ? (
                        <>
                          <ArchiveRestore className="size-3.5" /> Reativar
                        </>
                      ) : (
                        <>
                          <Archive className="size-3.5" /> Arquivar
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(c)}>
                      <Trash2 className="size-3.5" /> Apagar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
                <div className="px-3 py-2.5">
                  <p className="num text-xl leading-none">{c.broadcastCount}</p>
                  <p className="label-caps mt-1">Transmissões</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="num text-xl leading-none">{c.sentCount.toLocaleString("pt-BR")}</p>
                  <p className="label-caps mt-1">Enviadas</p>
                </div>
              </div>

              <div className="space-y-1.5 p-3 text-[11px]">
                <p className="flex items-center gap-1.5 text-ink-2">
                  <Workflow className="size-3.5 shrink-0 text-ink-3" />
                  <span className="truncate">
                    {c.flowName ? (
                      <>
                        {c.flowName}
                        {c.flowStatus !== "published" && (
                          <span className="ml-1 text-amber">(rascunho)</span>
                        )}
                      </>
                    ) : (
                      "Sem fluxo"
                    )}
                  </span>
                </p>
                {/* O modelo não é escolhido aqui: vem do primeiro bloco do fluxo.
                    Mostrar mesmo assim evita abrir o canvas só pra ver qual
                    mensagem abre a conversa. */}
                <p className="flex items-center gap-1.5 text-ink-2">
                  <MessageSquare className="size-3.5 shrink-0 text-ink-3" />
                  <span className="truncate">
                    {c.templateName ? (
                      <>
                        Abre com {c.templateName}
                        {c.templateStatus !== "APPROVED" && (
                          <span className="ml-1 text-amber">({c.templateStatus})</span>
                        )}
                      </>
                    ) : (
                      "Fluxo ainda sem modelo de abertura"
                    )}
                  </span>
                </p>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-3 py-2">
                <StatusBadge tone={c.status === "active" ? "ok" : "neutral"}>
                  {c.status === "active" ? "Ativa" : "Arquivada"}
                </StatusBadge>
                <Button asChild size="xs" disabled={!c.sendable}>
                  <Link href={`/transmissao/nova?campanha=${c.id}`}>
                    <Send className="size-3" /> Transmitir
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editor?.mode === "create" ? "Nova campanha" : "Editar campanha"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              A campanha é o grupo da informação: ela aponta para um fluxo, e é o primeiro bloco
              desse fluxo que abre a conversa. A transmissão é o envio dela.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="camp-name">Nome</Label>
              <Input
                id="camp-name"
                value={name}
                maxLength={80}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                placeholder="Cobrança de setembro"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-desc">Descrição</Label>
              <Input
                id="camp-desc"
                value={description}
                maxLength={280}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-flow">Fluxo</Label>
              <select
                id="camp-flow"
                value={flowId}
                onChange={(e) => setFlowId(e.target.value)}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">Escolher depois</option>
                {flows.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.status !== "published" ? " — rascunho" : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-ink-3">
                Só fluxo publicado transmite, e ele precisa ter o modelo de abertura escolhido no
                primeiro bloco.
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button onClick={submit} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />} Salvar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Só dá pra apagar campanha que nunca transmitiu. Se já transmitiu, arquive.
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
