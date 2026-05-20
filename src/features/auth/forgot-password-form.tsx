"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

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
import { requestPasswordResetAction, type ActionResult } from "@/features/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Enviando..." : "Enviar link de recuperação"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    requestPasswordResetAction,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Esqueci a senha</CardTitle>
        <CardDescription>
          Informe seu email e enviaremos um link para redefinir a senha.
        </CardDescription>
      </CardHeader>
      <form action={formAction} className="space-y-4">
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="voce@empresa.com"
            />
            {state?.ok === false && state.fieldErrors?.email && (
              <p className="text-destructive text-xs">{state.fieldErrors.email}</p>
            )}
          </div>
          {state?.ok === false && !state.fieldErrors && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}
          {state?.ok === true && (
            <p className="text-sm text-muted-foreground">
              Se o email estiver cadastrado, você receberá em instantes um link para redefinir a
              senha.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <SubmitButton />
          <p className="text-muted-foreground text-center text-sm">
            <Link href="/login" className="text-primary hover:underline">
              Voltar para entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
