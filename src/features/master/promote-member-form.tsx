"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { promoteMasterMemberAction, type ActionResult } from "@/features/master/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adicionando..." : "Dar acesso master"}
    </Button>
  );
}

export function PromoteMasterMemberForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    promoteMasterMemberAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Acesso master concedido");
      formRef.current?.reset();
    }
    if (state?.ok === false && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1 space-y-2">
        <Label htmlFor="promote-email">E-mail</Label>
        <Input
          id="promote-email"
          name="email"
          type="email"
          required
          placeholder="pessoa@autoprocs.com"
        />
        <p className="text-muted-foreground text-xs">
          Convida por e-mail se a pessoa ainda não tem conta; se já tiver, só ativa o acesso master.
        </p>
      </div>
      <SubmitButton />
    </form>
  );
}
