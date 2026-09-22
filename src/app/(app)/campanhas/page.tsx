import { PageHeader } from "@/components/page-header";
import { CampaignsGrid } from "@/features/campaigns/campaigns-grid";
import { listCampaigns } from "@/server/campaigns";
import { listFlows } from "@/server/flows";

export default async function CampanhasPage() {
  const [campaigns, { flows }] = await Promise.all([listCampaigns(), listFlows()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Campanhas"
        description="A campanha é o grupo da informação: ela escolhe o fluxo, e o primeiro bloco do fluxo é o modelo que abre a conversa. É dela que sai cada transmissão."
      />
      <CampaignsGrid
        campaigns={campaigns}
        flows={flows.map((f) => ({ id: f.id, name: f.name, status: f.status }))}
      />
    </div>
  );
}
