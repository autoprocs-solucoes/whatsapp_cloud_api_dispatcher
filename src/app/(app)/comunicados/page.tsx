import { Send } from "lucide-react";

import { PageEmptyState } from "@/components/page-empty-state";

export default function ComunicadosPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Comunicados</h1>
        <p className="text-muted-foreground text-sm">
          Histórico de disparos e criação de novos comunicados.
        </p>
      </header>
      <PageEmptyState
        icon={Send}
        title="Comunicados em construção"
        description="Wizard de disparo (template, número remetente, mapeamento de variáveis, segmento, teste, confirmação), com filtro automático de opt-outs."
        epic="E7"
      />
    </div>
  );
}
