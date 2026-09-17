"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function MasterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center duration-500">
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-2xl">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Algo deu errado nessa tela</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          O resto do painel continua funcionando. Tente de novo; se persistir, me manda o
          código abaixo.
        </p>
        {error.digest && (
          <p className="text-muted-foreground font-mono text-[11px]">{error.digest}</p>
        )}
      </div>
      <Button onClick={reset} size="sm">
        <RotateCcw className="mr-1.5 size-4" /> Tentar de novo
      </Button>
    </div>
  );
}
