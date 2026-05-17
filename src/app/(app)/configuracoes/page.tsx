import { Settings } from "lucide-react";

import { PageEmptyState } from "@/components/page-empty-state";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Dados do workspace, conexão com Meta e gestão de usuários.
        </p>
      </header>
      <PageEmptyState
        icon={Settings}
        title="Configurações em construção"
        description="Edição do workspace, botão de conectar Facebook (Embedded Signup), lista de phone numbers do WABA e convite de membros."
        epic="E1 + E2"
      />
    </div>
  );
}
