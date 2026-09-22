import { PageHeader } from "@/components/page-header";
import { CampaignsGrid } from "@/features/campaigns/campaigns-grid";
import { listTemplatesForWorkspace } from "@/features/templates/actions";
import { listCampaigns } from "@/server/campaigns";
import { listFlows } from "@/server/flows";

export default async function CampanhasPage() {
  const [campaigns, templates, { flows }] = await Promise.all([
    listCampaigns(),
    listTemplatesForWorkspace(),
    listFlows(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Campanhas"
        description="A campanha é o grupo da informação: o modelo que abre a conversa e o fluxo que continua. É dela que sai cada transmissão."
      />
      <CampaignsGrid
        campaigns={campaigns}
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          language: t.language,
        }))}
        flows={flows
          .filter((f) => f.status === "published")
          .map((f) => ({ id: f.id, name: f.name }))}
      />
    </div>
  );
}
