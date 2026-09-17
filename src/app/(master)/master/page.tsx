import { PageHeader } from "@/components/page-header";
import { ClientsGrid } from "@/features/master/clients-grid";
import { listWorkspacesForMaster } from "@/server/master";

export default async function MasterClientesPage() {
  const workspaces = await listWorkspacesForMaster();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        description="Visão cross-tenant de todos os workspaces da plataforma. Clique em Entrar pra acessar o cliente com o menu completo dele."
      />
      <ClientsGrid workspaces={workspaces} />
    </div>
  );
}
