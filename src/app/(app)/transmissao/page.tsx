import Link from "next/link";
import { Plus, Send } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DispatchesTable } from "@/features/dispatch/dispatches-table";
import { listDispatches } from "@/features/dispatch/actions";

export default async function TransmissaoPage() {
  const dispatches = await listDispatches();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transmissão"
        description="Cada transmissão envia uma campanha para um segmento ou lista. Agende, acompanhe e pause daqui."
        actions={
          <Button asChild size="sm">
            <Link href="/transmissao/nova">
              <Plus className="size-4" /> Criar nova transmissão
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
              <h2 className="text-base font-semibold text-ink">Nenhuma transmissão ainda</h2>
              <p className="max-w-sm text-sm text-ink-2">
                Crie a primeira escolhendo uma campanha — ou um template aprovado, se for avulsa.
              </p>
            </div>
            <Button asChild size="sm" className="mt-1">
              <Link href="/transmissao/nova">
                <Plus className="size-4" /> Criar nova transmissão
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
