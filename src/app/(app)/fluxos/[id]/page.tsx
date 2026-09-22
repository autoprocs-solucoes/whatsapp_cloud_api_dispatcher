import { notFound } from "next/navigation";

import { FlowEditor } from "@/features/flows/flow-editor";
import { parseGraph } from "@/features/flows/schemas";
import { listTemplatesForWorkspace } from "@/features/templates/actions";
import { getFlow } from "@/server/flows";

export default async function FluxoEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [flow, templates] = await Promise.all([getFlow(id), listTemplatesForWorkspace()]);
  if (!flow) notFound();

  return (
    <FlowEditor
      flowId={flow.id}
      flowName={flow.name}
      status={flow.status}
      graph={parseGraph(flow.graph)}
      templates={templates
        .filter((t) => t.status === "APPROVED" && t.active)
        .map((t) => ({
          id: t.id,
          name: t.name,
          language: t.language,
          bodyText: t.body_text,
        }))}
    />
  );
}
