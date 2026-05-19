import Link from "next/link";
import { Plus, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentsTable } from "@/features/segments/segments-table";
import { listSegments } from "@/features/segments/actions";

export default async function SegmentosPage() {
  const segments = await listSegments();

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Segmentos</h1>
          <p className="text-muted-foreground text-sm">
            Crie regras sobre tags e campos custom para reusar nos comunicados.
          </p>
        </div>
        <Button asChild>
          <Link href="/segmentos/novo">
            <Plus className="mr-1 size-4" /> Novo segmento
          </Link>
        </Button>
      </header>

      {segments.length === 0 ? (
        <div className="rounded-md border border-dashed py-16 text-center">
          <div className="bg-primary/10 text-primary mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl">
            <Tag className="size-6" />
          </div>
          <h2 className="text-base font-medium">Nenhum segmento ainda</h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            Crie um segmento pra reaproveitar regras de destinatários em vários comunicados.
          </p>
        </div>
      ) : (
        <SegmentsTable segments={segments} />
      )}
    </div>
  );
}
