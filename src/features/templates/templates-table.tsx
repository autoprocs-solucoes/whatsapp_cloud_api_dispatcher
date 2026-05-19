"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { syncTemplatesAction } from "@/features/templates/actions";
import { cn } from "@/lib/utils";
import type { Template } from "@/lib/supabase/database.types";

type Props = {
  templates: Template[];
  canSync: boolean;
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

function truncate(s: string | null, n: number): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function TemplatesTable({ templates, canSync }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {templates.length} template(s) no cache local.
        </p>
        {canSync && (
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

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Nome</th>
              <th className="px-3 py-2 text-left font-medium">Idioma</th>
              <th className="px-3 py-2 text-left font-medium">Categoria</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Body</th>
              <th className="px-3 py-2 text-left font-medium">Última sync</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted-foreground px-3 py-8 text-center">
                  Nenhum template no cache. Clique em <strong>Sincronizar</strong> pra puxar da
                  Meta.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className={cn("border-t", t.status !== "APPROVED" && "opacity-70")}>
                  <td className="px-3 py-2 font-medium">{t.name}</td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">{t.language}</td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">{t.category}</td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(t.status)} className="text-[10px]">
                      {t.status}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground max-w-[400px] px-3 py-2 text-xs">
                    {truncate(t.body_text, 120)}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {new Date(t.last_synced_at).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
