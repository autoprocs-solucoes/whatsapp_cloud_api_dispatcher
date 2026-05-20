"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { executeDispatchAction } from "@/features/dispatch/actions";

type Props = {
  dispatchId: string;
  total: number;
  status: "draft" | "queued" | "running" | "done" | "failed" | "canceled";
};

const REFRESH_INTERVAL_MS = 4000;

export function DispatchExecutePanel({ dispatchId, total, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Enquanto queued/running, refaz fetch do server component a cada N segundos
  // pra atualizar contadores sem precisar F5.
  useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const t = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [status, router]);

  function handleRun() {
    const fd = new FormData();
    fd.append("id", dispatchId);
    startTransition(async () => {
      const res = await executeDispatchAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Comunicado enfileirado · processando em background");
      router.refresh();
    });
  }

  if (status === "draft") {
    return (
      <div className="border-primary/20 bg-primary/5 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Comunicado em rascunho</p>
            <p className="text-muted-foreground text-xs">
              {total} destinatário(s). Worker em background dispara em lotes —
              pode fechar essa aba que continua.
            </p>
          </div>
          <Button onClick={handleRun} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" /> Enfileirando…
              </>
            ) : (
              <>
                <Send className="mr-1 size-4" /> Disparar agora
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "queued" || status === "running") {
    return (
      <div className="border-primary/20 bg-primary/5 flex items-start gap-3 rounded-md border p-4">
        <Loader2 className="text-primary mt-0.5 size-4 shrink-0 animate-spin" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {status === "queued" ? "Na fila do worker" : "Em execução"}
          </p>
          <p className="text-muted-foreground text-xs">
            Worker processa em background. Pode fechar a aba — atualizamos
            a tela a cada {Math.round(REFRESH_INTERVAL_MS / 1000)}s enquanto
            estiver aqui.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
