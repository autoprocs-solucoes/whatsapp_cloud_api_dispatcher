"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteMemberAction, type ActionResult } from "@/features/workspace/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Convidando..." : "Convidar"}
    </Button>
  );
}

type Props = {
  workspaceId: string;
};

export function InviteMemberForm({ workspaceId }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    inviteMemberAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Convite enviado");
      formRef.current?.reset();
    }
    if (state?.ok === false && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="min-w-[240px] flex-1 space-y-2">
        <Label htmlFor="invite-email">Email do convidado</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="pessoa@empresa.com"
        />
        {state?.ok === false && state.fieldErrors?.email && (
          <p className="text-destructive text-xs">{state.fieldErrors.email}</p>
        )}
      </div>
      <SubmitButton />
    </form>
  );
}
