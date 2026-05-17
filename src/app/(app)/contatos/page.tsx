import { Users } from "lucide-react";

import { PageEmptyState } from "@/components/page-empty-state";

export default function ContatosPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Contatos</h1>
        <p className="text-muted-foreground text-sm">
          Importe contatos via planilha, gerencie campos custom e opt-outs.
        </p>
      </header>
      <PageEmptyState
        icon={Users}
        title="Gestão de contatos em construção"
        description="Wizard de import de 3 passos (upload, mapeamento, validação), lista paginada, edição individual e marcação de opt-out."
        epic="E4"
      />
    </div>
  );
}
