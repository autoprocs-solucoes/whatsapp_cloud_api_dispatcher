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
import { signUpAction, type ActionResult } from "@/features/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Criando conta..." : "Criar conta"}
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(signUpAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>
          Cadastre-se para começar a usar o Autoprocs Dispatcher.
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
              placeholder="Seu nome"
            />
            {state?.ok === false && state.fieldErrors?.fullName && (
              <p className="text-destructive text-xs">{state.fieldErrors.fullName}</p>
            )}
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
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
            Já tem conta?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
