import { redirect } from "next/navigation";

import { DispatchWizard } from "@/features/dispatch/wizard";
import { listTemplatesForWorkspace } from "@/features/templates/actions";
import { listSegments, listCustomFieldKeys } from "@/features/segments/actions";
import { getMetaConnection } from "@/server/meta";
import { requireActiveWorkspace } from "@/server/workspace";

type SearchParams = Promise<{ template?: string }>;

export default async function NovoComunicadoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const workspace = await requireActiveWorkspace();
  const [templates, segments, customKeys, conn, sp] = await Promise.all([
    listTemplatesForWorkspace(),
    listSegments(),
    listCustomFieldKeys(),
    getMetaConnection(workspace.id),
    searchParams,
  ]);

  if (!conn) {
    redirect("/configuracoes?missing_meta=1");
  }

  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");

  return (
    <div className="space-y-3">
      <header className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Novo comunicado</h1>
        <p className="text-muted-foreground text-xs">
          Wizard 6 passos · opt-outs filtrados automaticamente.
        </p>
      </header>

      <DispatchWizard
        templates={approvedTemplates}
        phoneNumbers={conn.phoneNumbers}
        segments={segments}
        customKeys={customKeys}
        initialTemplateId={sp.template}
      />
    </div>
  );
}
