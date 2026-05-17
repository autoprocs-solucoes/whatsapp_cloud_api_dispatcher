import { LayoutDashboard } from "lucide-react";

import { PageEmptyState } from "@/components/page-empty-state";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Visão geral do workspace: contatos, comunicados em andamento e métricas de entrega.
        </p>
      </header>
      <PageEmptyState
        icon={LayoutDashboard}
        title="Dashboard em construção"
        description="Vai mostrar total de contatos, último comunicado, taxa de entrega dos últimos 30 dias e atalhos rápidos."
        epic="E9"
      />
    </div>
  );
}
