"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppPreview, type PreviewButton } from "@/features/dispatch/whatsapp-preview";
import { setTemplateActiveAction, syncTemplatesAction } from "@/features/templates/actions";
import { cn } from "@/lib/utils";
import type { Template } from "@/lib/supabase/database.types";

type Props = {
  templates: Template[];
  isOwner: boolean;
};

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
      return "default";
    case "PENDING":
    case "IN_APPEAL":
      return "secondary";
    case "REJECTED":
    case "DISABLED":
      return "destructive";
    default:
      return "outline";
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

function TemplateCard({ template, isOwner }: { template: Template; isOwner: boolean }) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();
  const [isToggling, startToggle] = useTransition();

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
        "group relative flex h-full flex-col gap-3 rounded-lg border bg-card p-3 transition-shadow hover:shadow-md",
        (!isApproved || !isActive) && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold" title={template.name}>
            {template.name}
          </h3>
          <p className="text-muted-foreground text-[10px] uppercase">
            {template.language} · {template.category}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={statusVariant(template.status)} className="text-[10px]">
            {template.status}
          </Badge>
          {!isActive && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <EyeOff className="size-3" /> Desativado
            </Badge>
          )}
        </div>
      </div>

      <div className="flex justify-center">
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

      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[10px]">
          {new Date(template.last_synced_at).toLocaleDateString("pt-BR")}
        </span>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button
              onClick={handleToggle}
              disabled={isToggling}
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
            >
              {isToggling ? (
                <Loader2 className="size-3 animate-spin" />
              ) : isActive ? (
                "Desativar"
              ) : (
                "Reativar"
              )}
            </Button>
          )}
          {isApproved && isActive && (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link href={`/comunicados/novo?template=${template.id}`}>
                <Plus className="mr-1 size-3" /> Criar comunicado
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

export function TemplatesTable({ templates, isOwner }: Props) {
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
        <p className="text-muted-foreground text-sm">
          {filteredTemplates.length} de {templates.length} template(s) no cache local. Hover
          preenche com valores de exemplo.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-0.5">
            {ACTIVE_FILTER_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                onClick={() => setActiveFilter(opt.value)}
                size="sm"
                variant={activeFilter === opt.value ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {isOwner && (
            <Button onClick={handleSync} disabled={isPending} size="sm">
              {isPending ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" /> Sincronizando…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-1 size-4" /> Sincronizar
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed px-3 py-12 text-center text-sm">
          Nenhum template no cache. Clique em <strong>Sincronizar</strong> pra puxar da Meta.
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed px-3 py-12 text-center text-sm">
          Nenhum template {activeFilter === "active" ? "ativo" : "desativado"} pra mostrar.
        </div>
      ) : (
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((t) => (
            <TemplateCard key={t.id} template={t} isOwner={isOwner} />
          ))}
        </div>
      )}
    </div>
  );
}
