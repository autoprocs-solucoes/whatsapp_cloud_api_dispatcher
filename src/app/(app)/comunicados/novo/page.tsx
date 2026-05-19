import { redirect } from "next/navigation";

import { DispatchWizard } from "@/features/dispatch/wizard";
import { listTemplatesForWorkspace } from "@/features/templates/actions";
import { listSegments, listCustomFieldKeys } from "@/features/segments/actions";
import { getMetaConnection } from "@/server/meta";
import { requireActiveWorkspace } from "@/server/workspace";

export default async function NovoComunicadoPage() {
  const workspace = await requireActiveWorkspace();
  const [templates, segments, customKeys, conn] = await Promise.all([
    listTemplatesForWorkspace(),
    listSegments(),
    listCustomFieldKeys(),
    getMetaConnection(workspace.id),
  ]);

  if (!conn) {
    redirect("/configuracoes?missing_meta=1");
  }

  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Novo comunicado</h1>
        <p className="text-muted-foreground text-sm">
          Wizard de 6 passos · opt-outs filtrados automaticamente.
        </p>
      </header>

      <DispatchWizard
        templates={approvedTemplates}
        phoneNumbers={conn.phoneNumbers}
        segments={segments}
        customKeys={customKeys}
      />
    </div>
  );
}
