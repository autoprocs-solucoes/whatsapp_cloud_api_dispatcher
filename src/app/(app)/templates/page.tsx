import { MessageSquare } from "lucide-react";

import { PageEmptyState } from "@/components/page-empty-state";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="text-muted-foreground text-sm">
          Templates aprovados pela Meta + criação com submissão para aprovação.
        </p>
      </header>
      <PageEmptyState
        icon={MessageSquare}
        title="Templates em construção"
        description="Listar templates do WABA conectado, criar novo (header, body, buttons) com submissão pra Meta, preview renderizado com contato real."
        epic="E5"
      />
    </div>
  );
}
