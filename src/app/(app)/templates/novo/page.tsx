import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { TemplateWizard } from "@/features/templates/template-wizard";
import { listTemplatesForWorkspace } from "@/features/templates/actions";
import { requireUser } from "@/server/auth";
import { getMetaConnections } from "@/server/meta";
import { requireActiveWorkspace } from "@/server/workspace";

/**
 * Criação de modelo de mensagem. O modelo nasce na Meta (é ela quem aprova),
 * então sem conexão não há o que criar — manda pra Configurações.
 */
export default async function NovoTemplatePage() {
  const user = await requireUser();
  const workspace = await requireActiveWorkspace();
  const canManage = workspace.role === "owner" || user.profile.is_superadmin;
  if (!canManage) notFound();

  const [connections, templates] = await Promise.all([
    getMetaConnections(workspace.id),
    listTemplatesForWorkspace(),
  ]);
  if (connections.length === 0) redirect("/configuracoes");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Criar modelo"
        description="Monte a mensagem, dê exemplos das variáveis e envie pra revisão da Meta."
      />
      <TemplateWizard
        connections={connections.map(({ connection }) => ({
          id: connection.id,
          label: connection.business_name ?? connection.waba_id,
        }))}
        existing={templates.map((t) => ({ name: t.name, language: t.language }))}
      />
    </div>
  );
}
