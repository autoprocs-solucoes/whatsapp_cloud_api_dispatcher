import { PageHeader } from "@/components/page-header";
import { FlowsBrowser } from "@/features/flows/flows-browser";
import { listFlows } from "@/server/flows";

export default async function FluxosPage() {
  const { folders, flows } = await listFlows();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fluxos de conversa"
        description="Monte a conversa em blocos: mensagem, botões e espera. Publicado, o fluxo fica disponível pra campanha e transmissão."
      />
      <FlowsBrowser folders={folders} flows={flows} />
    </div>
  );
}
