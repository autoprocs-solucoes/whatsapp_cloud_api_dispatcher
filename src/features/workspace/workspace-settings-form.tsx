"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateWorkspaceAction, type ActionResult } from "@/features/workspace/actions";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

type Props = {
  workspaceId: string;
  initialName: string;
  canEdit: boolean;
};

export function WorkspaceSettingsForm({ workspaceId, initialName, canEdit }: Props) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateWorkspaceAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) toast.success("Workspace atualizado");
    if (state?.ok === false && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="space-y-2">
        <Label htmlFor="name">Nome do workspace</Label>
        <Input
          id="name"
          name="name"
          defaultValue={initialName}
          disabled={!canEdit}
          required
        />
      </div>
      {!canEdit && (
        <p className="text-muted-foreground text-xs">Apenas owners podem editar o workspace.</p>
      )}
      <SubmitButton disabled={!canEdit} />
    </form>
  );
}
