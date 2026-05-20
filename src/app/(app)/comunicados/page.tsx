import Link from "next/link";
import { Plus, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listDispatches } from "@/features/dispatch/actions";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  running: "Em execução",
  done: "Concluído",
  failed: "Falhou",
  canceled: "Cancelado",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "done":
      return "default";
    case "running":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

export default async function ComunicadosPage() {
  const dispatches = await listDispatches();

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comunicados</h1>
          <p className="text-muted-foreground text-sm">
            Histórico de disparos e criação de novos comunicados.
          </p>
        </div>
        <Button asChild>
          <Link href="/comunicados/novo">
            <Plus className="mr-1 size-4" /> Novo comunicado
          </Link>
        </Button>
      </header>

      {dispatches.length === 0 ? (
        <div className="rounded-md border border-dashed py-16 text-center">
          <div className="bg-primary/10 text-primary mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl">
            <Send className="size-6" />
          </div>
          <h2 className="text-base font-medium">Nenhum comunicado ainda</h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            Crie seu primeiro comunicado escolhendo um template aprovado.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Template</th>
                <th className="px-3 py-2 text-left font-medium">Origem</th>
                <th className="px-3 py-2 text-left font-medium">Segmentação</th>
                <th className="px-3 py-2 text-left font-medium">Total</th>
                <th className="px-3 py-2 text-left font-medium">Enviados</th>
                <th className="px-3 py-2 text-left font-medium">Falhas</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map((d) => {
                const sent = d.counts.sent ?? 0;
                const delivered = d.counts.delivered ?? 0;
                const read = d.counts.read ?? 0;
                const failed = d.counts.failed ?? 0;
                const positives = sent + delivered + read;
                return (
                  <tr key={d.id} className={cn("border-t hover:bg-muted/20")}>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/comunicados/${d.id}`} className="hover:underline">
                        {d.template_name ?? "—"}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {d.recipient_source === "segment" ? "Segmento" : "Lista manual"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {d.recipient_source === "segment" ? (
                        d.segment_name ? (
                          <Badge variant="outline" className="text-[10px]">
                            {d.segment_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Segmento removido</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{d.total_recipients}</td>
                    <td className="px-3 py-2 text-xs">{positives}</td>
                    <td className="text-destructive px-3 py-2 text-xs">{failed}</td>
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant(d.status)} className="text-[10px]">
                        {STATUS_LABELS[d.status] ?? d.status}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {new Date(d.created_at).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
