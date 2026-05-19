import { SegmentEditor } from "@/features/segments/segment-editor";
import { listCustomFieldKeys } from "@/features/segments/actions";

export default async function NovoSegmentoPage() {
  const customKeys = await listCustomFieldKeys();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Novo segmento</h1>
        <p className="text-muted-foreground text-sm">
          Defina regras sobre tags, nome e campos custom.
        </p>
      </header>
      <SegmentEditor mode="create" customKeys={customKeys} />
    </div>
  );
}
