"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { executeDispatchAction } from "@/features/dispatch/actions";

type Props = {
  dispatchId: string;
  total: number;
};

export function DispatchExecutePanel({ dispatchId, total }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    const fd = new FormData();
    fd.append("id", dispatchId);
    startTransition(async () => {
      const res = await executeDispatchAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Enviados ${res.data.sent} · Falhas ${res.data.failed}`);
      router.refresh();
    });
  }

  return (
    <div className="border-primary/20 bg-primary/5 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Comunicado em rascunho</p>
          <p className="text-muted-foreground text-xs">
            Envio sequencial via WhatsApp Cloud API · {total} destinatário(s) ·
            pausa 300ms entre envios.
          </p>
        </div>
        <Button onClick={handleRun} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-1 size-4 animate-spin" /> Disparando…
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
