import { redirect } from "next/navigation";

import { DispatchWizard } from "@/features/dispatch/wizard";
import { getDispatchPreset } from "@/features/dispatch/actions";
import { listTemplatesForWorkspace } from "@/features/templates/actions";
import { listSegments, listCustomFieldKeys } from "@/features/segments/actions";
import { getMetaConnection } from "@/server/meta";
import { requireActiveWorkspace } from "@/server/workspace";

type SearchParams = Promise<{ template?: string; from?: string }>;

export default async function NovoComunicadoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const workspace = await requireActiveWorkspace();
  const sp = await searchParams;
  const [templates, segments, customKeys, conn, preset] = await Promise.all([
    listTemplatesForWorkspace(),
    listSegments(),
    listCustomFieldKeys(),
    getMetaConnection(workspace.id),
    sp.from ? getDispatchPreset(sp.from) : Promise.resolve(null),
  ]);

  if (!conn) {
    redirect("/configuracoes?missing_meta=1");
  }

  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");
  const isDuplicate = Boolean(preset);

  return (
    <div className="space-y-3">
      <header className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold tracking-tight">
          {isDuplicate ? "Duplicar comunicado" : "Novo comunicado"}
        </h1>
        <p className="text-muted-foreground text-xs">
          {isDuplicate
            ? "Configurações pré-preenchidas · revise antes de disparar."
            : "Wizard 6 passos · opt-outs filtrados automaticamente."}
        </p>
      </header>

      <DispatchWizard
        templates={approvedTemplates}
        phoneNumbers={conn.phoneNumbers}
        segments={segments}
        customKeys={customKeys}
        initialTemplateId={sp.template}
        initialPreset={preset}
      />
    </div>
  );
}
