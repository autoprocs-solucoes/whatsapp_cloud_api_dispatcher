"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspaceAction, type ActionResult } from "@/features/workspace/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Criando..." : "Criar workspace"}
    </Button>
  );
}

export function CreateWorkspaceForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createWorkspaceAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do workspace</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="ex: Minha Empresa, Cliente Alpha"
        />
        {state?.ok === false && state.fieldErrors?.name && (
          <p className="text-destructive text-xs">{state.fieldErrors.name}</p>
        )}
      </div>
      {state?.ok === false && !state.fieldErrors && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}
      <SubmitButton />
    </form>
  );
}
