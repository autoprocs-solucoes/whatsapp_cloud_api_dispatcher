import { notFound } from "next/navigation";

import { FlowEditor } from "@/features/flows/flow-editor";
import { parseGraph } from "@/features/flows/schemas";
import { getFlow } from "@/server/flows";

export default async function FluxoEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const flow = await getFlow(id);
  if (!flow) notFound();

  return (
    <FlowEditor
      flowId={flow.id}
      flowName={flow.name}
      status={flow.status}
      graph={parseGraph(flow.graph)}
    />
  );
}
