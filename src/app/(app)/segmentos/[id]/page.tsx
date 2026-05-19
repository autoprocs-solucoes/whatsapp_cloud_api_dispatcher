import { notFound } from "next/navigation";

import { SegmentEditor } from "@/features/segments/segment-editor";
import { getSegment, listCustomFieldKeys } from "@/features/segments/actions";
import { rulesSchema, type Rules } from "@/features/segments/schemas";

type Params = Promise<{ id: string }>;

export default async function EditarSegmentoPage({ params }: { params: Params }) {
  const { id } = await params;
  const [segment, customKeys] = await Promise.all([getSegment(id), listCustomFieldKeys()]);

  if (!segment) notFound();

  let parsedRules: Rules;
  try {
    parsedRules = rulesSchema.parse(segment.rules);
  } catch {
    parsedRules = { match: "and", rules: [] };
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Editar segmento</h1>
        <p className="text-muted-foreground text-sm">
          Atualize regras e nome. Mudanças se refletem em comunicados futuros.
        </p>
      </header>
      <SegmentEditor
        mode="edit"
        customKeys={customKeys}
        initial={{ id: segment.id, name: segment.name, rules: parsedRules }}
      />
    </div>
  );
}
