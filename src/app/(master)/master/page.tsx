import { PageHeader } from "@/components/page-header";
import { ClientsGrid } from "@/features/master/clients-grid";
import { WebhookPanel } from "@/features/master/webhook-panel";
import { listWorkspacesForMaster } from "@/server/master";

export default async function MasterClientesPage() {
  const workspaces = await listWorkspacesForMaster();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        description="Visão cross-tenant de todos os workspaces da plataforma. Clique em Entrar pra acessar o cliente com o menu completo dele."
      />
      <WebhookPanel />
      <ClientsGrid workspaces={workspaces} />
    </div>
  );
}
