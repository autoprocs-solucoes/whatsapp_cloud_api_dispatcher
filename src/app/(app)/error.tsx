"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

// Error boundary do grupo (app): mantém a casca (sidebar/header) e mostra
// um estado recuperável em vez da tela padrão do Next.
export default function AppError({
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
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg border border-red-line bg-red-soft text-red">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Algo deu errado nessa tela</h2>
        <p className="max-w-sm text-sm text-ink-2">
          O resto do app continua funcionando. Tente de novo; se persistir, me manda o código
          abaixo.
        </p>
        {error.digest && (
          <p className="font-mono text-[11px] text-ink-3">{error.digest}</p>
        )}
      </div>
      <Button onClick={reset} size="sm">
        <RotateCcw className="mr-1.5 size-4" /> Tentar de novo
      </Button>
    </div>
  );
}
