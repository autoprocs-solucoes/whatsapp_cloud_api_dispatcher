"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge, type StatusTone } from "@/components/status-badge";
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
import { WhatsAppPreview, type PreviewButton } from "@/features/dispatch/whatsapp-preview";
import {
  deleteTemplateAction,
  setTemplateActiveAction,
  syncTemplatesAction,
} from "@/features/templates/actions";
import { cn } from "@/lib/utils";
import type { Template } from "@/lib/supabase/database.types";
import type { TemplateAnalyticsPoint } from "@/lib/meta/graph-api";

type Props = {
  templates: Template[];
  isOwner: boolean;
  analyticsByTemplateId: Map<string, TemplateAnalyticsPoint>;
};

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Aprovado",
  PENDING: "Em análise",
  IN_APPEAL: "Em recurso",
  REJECTED: "Rejeitado",
  DISABLED: "Desabilitado",
  PAUSED: "Pausado",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function statusTone(status: string): StatusTone {
  switch (status) {
    case "APPROVED":
      return "ok";
    case "PENDING":
    case "IN_APPEAL":
    case "PAUSED":
      return "pending";
    case "REJECTED":
    case "DISABLED":
      return "danger";
    default:
      return "neutral";
  }
}

type ComponentRaw = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: { type?: string; text?: string }[];
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_text_named_params?: { param_name?: string; example?: string }[];
    body_text_named_params?: { param_name?: string; example?: string }[];
  };
};

function extractExampleResolved(componentsRaw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(componentsRaw)) return out;
  for (const c of componentsRaw as ComponentRaw[]) {
    if (!c || typeof c !== "object") continue;
    const ex = c.example;
    if (!ex) continue;

    if (c.type === "HEADER") {
      if (Array.isArray(ex.header_text)) {
        ex.header_text.forEach((v, i) => {
          out[`header:${i + 1}`] = String(v);
        });
      }
      if (Array.isArray(ex.header_text_named_params)) {
        for (const n of ex.header_text_named_params) {
          if (n?.param_name) out[`header:${n.param_name}`] = String(n.example ?? "");
        }
      }
    } else if (c.type === "BODY") {
      const arr = ex.body_text;
      if (Array.isArray(arr) && arr.length > 0 && Array.isArray(arr[0])) {
        arr[0]!.forEach((v, i) => {
          out[`body:${i + 1}`] = String(v);
        });
      }
      if (Array.isArray(ex.body_text_named_params)) {
        for (const n of ex.body_text_named_params) {
          if (n?.param_name) out[`body:${n.param_name}`] = String(n.example ?? "");
        }
      }
    }
  }
  return out;
}

function extractButtons(buttons: unknown): PreviewButton[] {
  if (!Array.isArray(buttons)) return [];
  return (buttons as { type?: string; text?: string }[])
    .filter((b) => typeof b?.text === "string")
    .map((b) => ({ type: b.type ?? "QUICK_REPLY", text: b.text! }));
}

function TemplateAnalyticsStats({ analytics }: { analytics: TemplateAnalyticsPoint | undefined }) {
  if (!analytics || analytics.sent === 0) return null;
  return (
    <div className="grid grid-cols-4 gap-1 rounded-md border border-line bg-card-2 px-2 py-1.5 text-center text-[10px] text-ink-3">
      <div>
        <p className="num text-[13px]">{analytics.sent}</p>
        <p>Enviadas</p>
      </div>
      <div>
        <p className="num text-[13px]">{analytics.delivered}</p>
        <p>Entregues</p>
      </div>
      <div>
        <p className="num text-[13px]">{analytics.read}</p>
        <p>Lidas</p>
      </div>
      <div>
        <p className="num text-[13px]">{analytics.clicked}</p>
        <p>Cliques</p>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  isOwner,
  analytics,
}: {
  template: Template;
  isOwner: boolean;
  analytics: TemplateAnalyticsPoint | undefined;
}) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();
  const [isToggling, startToggle] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteTemplateAction(template.id);
      if (result.ok) {
        toast.success("Modelo apagado");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const examples = useMemo(
    () => extractExampleResolved(template.components_raw),
    [template.components_raw],
  );
  const buttons = useMemo(() => extractButtons(template.buttons), [template.buttons]);

  const isApproved = template.status === "APPROVED";
  const isActive = template.active;

  function handleToggle() {
    startToggle(async () => {
      const res = await setTemplateActiveAction(template.id, !isActive);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isActive ? "Template desativado." : "Template reativado.");
      router.refresh();
    });
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group flex h-full flex-col rounded-lg border border-line bg-card shadow-card transition-colors hover:border-line-3",
        (!isApproved || !isActive) && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-line p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-card-2 text-[10px] font-semibold text-ink-2">
            {template.name
              .split(/[\s_-]+/)
              .map((p) => p[0]?.toUpperCase() ?? "")
              .join("")
              .slice(0, 2)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-ink" title={template.name}>
              {template.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Badge variant="secondary">{template.language}</Badge>
              <Badge variant="secondary">{template.category}</Badge>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge tone={statusTone(template.status)}>{statusLabel(template.status)}</StatusBadge>
          {!isActive && (
            <Badge variant="outline">
              <EyeOff className="size-3" /> Desativado
            </Badge>
          )}
        </div>
      </div>

      <div className="flex justify-center p-3">
        <WhatsAppPreview
          senderName="Empresa"
          headerText={template.header_text}
          bodyText={template.body_text}
          footerText={template.footer_text}
          buttons={buttons}
          resolved={hovered ? examples : {}}
          chatClassName="h-[280px]"
        />
      </div>

      <div className="px-3">
        <TemplateAnalyticsStats analytics={analytics} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-3 py-2.5">
        <span className="font-mono text-[11px] text-ink-3">
          Atualizado {new Date(template.last_synced_at).toLocaleDateString("pt-BR")}
        </span>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button onClick={handleToggle} disabled={isToggling} size="xs" variant="ghost">
              {isToggling ? (
                <Loader2 className="size-3 animate-spin" />
              ) : isActive ? (
                "Desativar"
              ) : (
                "Reativar"
              )}
            </Button>
          )}
          {isOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="xs"
                  variant="ghost"
                  aria-label="Apagar modelo"
                  disabled={isDeleting}
                  className="text-destructive"
                >
                  {isDeleting ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Trash2 className="size-3" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar {template.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O modelo sai da Meta e daqui. Comunicados já enviados continuam no histórico,
                    mas não dá pra disparar esse modelo de novo sem criar outro e esperar a
                    revisão.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction disabled={isDeleting} onClick={handleDelete}>
                    Apagar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isApproved && isActive && (
            <Button asChild size="xs">
              <Link href={`/comunicados/novo?template=${template.id}`}>
                <Plus className="size-3" /> Criar comunicado
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

type ActiveFilter = "all" | "active" | "inactive";

const ACTIVE_FILTER_OPTIONS: { value: ActiveFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Desativados" },
];

export function TemplatesTable({ templates, isOwner, analyticsByTemplateId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");

  function handleSync() {
    startTransition(async () => {
      const res = await syncTemplatesAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Sincronizados ${res.data.synced} template(s).`);
      router.refresh();
    });
  }

  const filteredTemplates = templates.filter((t) => {
    if (activeFilter === "active") return t.active;
    if (activeFilter === "inactive") return !t.active;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-line-2 bg-card p-0.5">
            {ACTIVE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setActiveFilter(opt.value)}
                className={cn(
                  "rounded-sm px-3 py-1 text-[13px] font-medium transition-colors",
                  activeFilter === opt.value
                    ? "bg-brand-soft text-brand-strong"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {isOwner && (
            <Button onClick={handleSync} disabled={isPending} size="sm">
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Sincronizando…
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" /> Sincronizar
                </>
              )}
            </Button>
          )}
        </div>
        <p className="text-xs text-ink-3">
          {filteredTemplates.length} de {templates.length} templates no cache local · passe o
          mouse pra preencher com exemplos
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-2 px-3 py-12 text-center text-sm text-ink-3">
          Nenhum template no cache. Clique em <strong className="text-ink">Sincronizar</strong>{" "}
          pra puxar da Meta.
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-2 px-3 py-12 text-center text-sm text-ink-3">
          Nenhum template {activeFilter === "active" ? "ativo" : "desativado"} pra mostrar.
        </div>
      ) : (
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isOwner={isOwner}
              analytics={analyticsByTemplateId.get(t.meta_template_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
