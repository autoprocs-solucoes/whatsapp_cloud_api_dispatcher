"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInviteAction, type ActionResult } from "@/features/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Salvando..." : "Aceitar convite e entrar"}
    </Button>
  );
}

type Props = {
  email: string;
  defaultFullName?: string;
};

export function AcceptInviteForm({ email, defaultFullName }: Props) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    acceptInviteAction,
    null,
  );

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Aceitar convite</CardTitle>
        <CardDescription>
          Você foi convidado para o Autoprocs Dispatcher como <strong>{email}</strong>. Defina seu
          nome e uma senha para começar.
        </CardDescription>
      </CardHeader>
      <form action={formAction} className="space-y-4">
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              defaultValue={defaultFullName ?? ""}
            />
            {state?.ok === false && state.fieldErrors?.fullName && (
              <p className="text-destructive text-xs">{state.fieldErrors.fullName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
            {state?.ok === false && state.fieldErrors?.password && (
              <p className="text-destructive text-xs">{state.fieldErrors.password}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
            {state?.ok === false && state.fieldErrors?.confirmPassword && (
              <p className="text-destructive text-xs">{state.fieldErrors.confirmPassword}</p>
            )}
          </div>
          {state?.ok === false && !state.fieldErrors && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
