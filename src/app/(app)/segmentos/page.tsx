import { Tag } from "lucide-react";

import { PageEmptyState } from "@/components/page-empty-state";

export default function SegmentosPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Segmentos</h1>
        <p className="text-muted-foreground text-sm">
          Construa regras sobre campos custom, tags e histórico de envios.
        </p>
      </header>
      <PageEmptyState
        icon={Tag}
        title="Segmentos em construção"
        description="Query builder visual com AND/OR aninhado, segmentos salvos com nome, preview de contagem em tempo real."
        epic="E6"
      />
    </div>
  );
}
