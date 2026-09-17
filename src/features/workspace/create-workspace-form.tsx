"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspaceAction, type ActionResult } from "@/features/workspace/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Criando..." : label}
    </Button>
  );
}

/**
 * `mode` decide o destino depois de criar:
 * - "onboarding": primeiro workspace do usuário — vira o ativo e abre o dashboard.
 * - "master": o admin está cadastrando um cliente — não troca o workspace ativo
 *   e volta pra lista de clientes.
 */
export function CreateWorkspaceForm({
  mode = "onboarding",
}: {
  mode?: "onboarding" | "master";
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createWorkspaceAction,
    null,
  );
  const isMaster = mode === "master";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <div className="space-y-2">
        <Label htmlFor="name">{isMaster ? "Nome do cliente" : "Nome do workspace"}</Label>
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
      <SubmitButton label={isMaster ? "Criar cliente" : "Criar workspace"} />
    </form>
  );
}
