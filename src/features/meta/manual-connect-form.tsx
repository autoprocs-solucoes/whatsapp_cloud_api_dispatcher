"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectMetaManuallyAction } from "@/features/meta/actions";

type ActionState =
  | { ok: true; data: unknown }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function SubmitButton({ ctaLabel }: { ctaLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Validando..." : ctaLabel}
    </Button>
  );
}

type Props = {
  workspaceId: string;
  ctaLabel?: string;
};

export function ManualMetaConnectForm({ workspaceId, ctaLabel = "Conectar" }: Props) {
  const [showToken, setShowToken] = React.useState(false);
  const [state, formAction] = useActionState<ActionState | null, FormData>(
    connectMetaManuallyAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) toast.success("Conta WhatsApp Business conectada");
    if (state?.ok === false && state.error && !state.fieldErrors) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />

      <div className="space-y-2">
        <Label htmlFor="wabaId">WhatsApp Business Account ID (WABA ID)</Label>
        <Input
          id="wabaId"
          name="wabaId"
          required
          placeholder="ex: 123456789012345"
          autoComplete="off"
          inputMode="numeric"
        />
        {state?.ok === false && state.fieldErrors?.wabaId && (
          <p className="text-destructive text-xs">{state.fieldErrors.wabaId}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="accessToken">Access Token (System User)</Label>
        <div className="flex gap-2">
          <Input
            id="accessToken"
            name="accessToken"
            required
            type={showToken ? "text" : "password"}
            placeholder="EAAxxxxxxxxxxxxxx..."
            autoComplete="off"
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowToken((v) => !v)}
            aria-label={showToken ? "Ocultar token" : "Mostrar token"}
          >
            {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
        {state?.ok === false && state.fieldErrors?.accessToken && (
          <p className="text-destructive text-xs">{state.fieldErrors.accessToken}</p>
        )}
        <p className="text-muted-foreground text-xs">
          Token gerado via System User no Business Manager. Sem expiração.
        </p>
      </div>

      <SubmitButton ctaLabel={ctaLabel} />
    </form>
  );
}
