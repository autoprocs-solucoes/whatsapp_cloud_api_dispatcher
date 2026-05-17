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
import { signInAction, type ActionResult } from "@/features/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(signInAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse sua conta da Autoprocs Dispatcher.</CardDescription>
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
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            {state?.ok === false && state.fieldErrors?.password && (
              <p className="text-destructive text-xs">{state.fieldErrors.password}</p>
            )}
          </div>
          {state?.ok === false && !state.fieldErrors && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <SubmitButton />
          <p className="text-muted-foreground text-center text-sm">
            Não tem conta?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Criar conta
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
