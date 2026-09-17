import Link from "next/link";
import { Plus, Send } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DispatchesTable } from "@/features/dispatch/dispatches-table";
import { listDispatches } from "@/features/dispatch/actions";

export default async function ComunicadosPage() {
  const dispatches = await listDispatches();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Comunicados"
        description="Histórico de disparos e criação de novos comunicados."
        actions={
          <Button asChild size="sm">
            <Link href="/comunicados/novo">
              <Plus className="size-4" /> Novo comunicado
            </Link>
          </Button>
        }
      />

      {dispatches.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Send className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">Nenhum comunicado ainda</h2>
              <p className="max-w-sm text-sm text-ink-2">
                Crie seu primeiro comunicado escolhendo um template aprovado.
              </p>
            </div>
            <Button asChild size="sm" className="mt-1">
              <Link href="/comunicados/novo">
                <Plus className="size-4" /> Novo comunicado
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DispatchesTable dispatches={dispatches} />
      )}
    </div>
  );
}
