"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogIn, MoreVertical, Plus, Search, Trash2 } from "lucide-react";

import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DeleteClientDialog } from "@/features/master/delete-client-dialog";
import { enterClientWorkspaceAction } from "@/features/master/actions";
import type { MasterWorkspaceRow } from "@/server/master";
import { cn } from "@/lib/utils";

const HEALTH_LABEL: Record<string, string> = {
  AVAILABLE: "Ativo",
  LIMITED: "Limitado",
  BLOCKED: "Bloqueado",
};

function healthLabel(status: string | null): string {
  if (!status) return "Conectada";
  return HEALTH_LABEL[status] ?? status;
}

/** Conectada é verde e sem conexão é vermelho. Os estados intermediários que a
 * Meta reporta (LIMITED / BLOCKED) mantêm âmbar e vermelho — o workspace está
 * conectado, mas não manda mensagem normalmente. Health ainda não sincronizada
 * (null) conta como conectada: existe conexão. */
function healthTone(status: string | null): StatusTone {
  switch (status) {
    case "LIMITED":
      return "pending";
    case "BLOCKED":
      return "danger";
    default:
      return "ok";
  }
}

function initials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

type MetaFilter = "all" | "connected" | "none";

const META_FILTERS: { value: MetaFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "connected", label: "Conectadas" },
  { value: "none", label: "Sem conexão" },
];

function ClientCard({ w }: { w: MasterWorkspaceRow }) {
  const conn = w.connections[0];
  const hasCoexistence = w.connections.some((c) => c.isCoexistence);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex flex-col rounded-lg border border-line bg-card shadow-card transition-colors hover:border-line-3">
      <div className="flex items-start justify-between gap-2 border-b border-line p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Mesma logo que o cliente vê no topo do menu dele. Iniciais só
              quando ele ainda não subiu nenhuma. */}
          {w.logoUrl ? (
            <Image
              src={w.logoUrl}
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 rounded-md border border-line object-cover"
            />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-card-2 text-[11px] font-semibold text-ink-2">
              {initials(w.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{w.name}</p>
            <p className="truncate font-mono text-[11px] text-ink-3">{w.slug}</p>
          </div>
        </div>
        <StatusBadge tone={conn ? healthTone(conn.canSendMessage) : "danger"}>
          {conn ? healthLabel(conn.canSendMessage) : "Sem conexão"}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
        <div className="px-3 py-2.5">
          <p className="num text-xl leading-none">{w.totalSent.toLocaleString("pt-BR")}</p>
          <p className="label-caps mt-1">Disparos</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="num text-xl leading-none">{w.memberCount.toLocaleString("pt-BR")}</p>
          <p className="label-caps mt-1">Membros</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="num text-xl leading-none">{w.contactCount.toLocaleString("pt-BR")}</p>
          <p className="label-caps mt-1">Contatos</p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 p-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate font-mono text-[11px] text-ink-2">{w.ownerEmail ?? "Sem owner"}</p>
          <p className="truncate text-[11px] text-ink-3">
            Meta: {conn ? (conn.businessName ?? conn.wabaId) : "sem conexão"} · desde{" "}
            {new Date(w.createdAt).toLocaleDateString("pt-BR")} · coexist.:{" "}
            {hasCoexistence ? "sim" : "não"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <form action={enterClientWorkspaceAction}>
            <input type="hidden" name="workspaceId" value={w.id} />
            <Button type="submit" size="sm" variant="outline">
              <LogIn className="size-3.5" /> Entrar
            </Button>
          </form>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Ações do cliente">
                <MoreVertical className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 className="size-3.5" /> Apagar cliente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DeleteClientDialog
        open={deleting}
        onOpenChange={setDeleting}
        workspaceId={w.id}
        name={w.name}
        memberCount={w.memberCount}
        contactCount={w.contactCount}
        totalSent={w.totalSent}
      />
    </div>
  );
}

export function ClientsGrid({ workspaces }: { workspaces: MasterWorkspaceRow[] }) {
  const [search, setSearch] = useState("");
  const [metaFilter, setMetaFilter] = useState<MetaFilter>("all");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workspaces.filter((w) => {
      if (metaFilter === "connected" && w.connections.length === 0) return false;
      if (metaFilter === "none" && w.connections.length > 0) return false;
      if (!term) return true;
      return (
        w.name.toLowerCase().includes(term) ||
        w.slug.toLowerCase().includes(term) ||
        (w.ownerEmail ?? "").toLowerCase().includes(term)
      );
    });
  }, [workspaces, search, metaFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente por nome ou owner"
            className="pl-8"
            aria-label="Buscar cliente"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="label-caps">Conexão Meta</span>
          <div className="flex items-center rounded-md border border-line-2 bg-card p-0.5">
            {META_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setMetaFilter(f.value)}
                className={cn(
                  "rounded-sm px-3 py-1 text-[13px] font-medium transition-colors",
                  metaFilter === f.value
                    ? "bg-brand-soft text-brand-strong"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-3">
          {rows.length} workspace{rows.length === 1 ? "" : "s"} ativo
          {rows.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((w) => (
          <ClientCard key={w.id} w={w} />
        ))}

        {/* Vai pro cadastro do painel master, não pro /onboarding — aquele é a
            tela de primeiro acesso e redireciona quem já tem workspace. */}
        <Link
          href="/master/novo-cliente"
          className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-2 text-ink-3 transition-colors hover:border-brand hover:text-brand"
        >
          <Plus className="size-5" />
          <span className="text-sm font-medium">Adicionar cliente</span>
        </Link>
      </div>
    </div>
  );
}
