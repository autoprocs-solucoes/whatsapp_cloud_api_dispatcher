"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileNameAction, type ActionResult } from "@/features/profile/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando…" : "Salvar"}
    </Button>
  );
}

export function ProfileNameForm({ initialName }: { initialName: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateProfileNameAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) toast.success("Nome atualizado");
    if (state?.ok === false && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-2">
      <Label htmlFor="full-name">Seu nome</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="full-name"
          name="fullName"
          defaultValue={initialName}
          placeholder="Como você aparece no app"
          required
          className="min-w-[240px] flex-1"
        />
        <SubmitButton />
      </div>
      <p className="text-xs text-ink-3">
        Aparece no rodapé do menu lateral e na lista do time.
      </p>
    </form>
  );
}
