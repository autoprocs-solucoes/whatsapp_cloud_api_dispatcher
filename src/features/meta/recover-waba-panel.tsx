"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { connectDiscoveredWabaAction } from "@/features/meta/actions";
import type { RecoverableWaba } from "@/server/meta-recovery";

type Props = {
  workspaceId: string;
  workspaceName: string;
  wabas: RecoverableWaba[];
};

/**
 * Contas que existem na Meta e não estão ligadas a cliente nenhum.
 *
 * O caso que deu origem a isto: o cliente concluiu o login integrado inteiro —
 * número registrado, cartão cadastrado — e do lado de cá não apareceu nada,
 * porque o aviso do popup se perdeu. A conta continuava lá, completa. Sem esta
 * lista, a única saída era refazer o cadastro ou colar credencial na mão.
 */
export function RecoverWabaPanel({ workspaceId, workspaceName, wabas }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [connecting, setConnecting] = useState<string | null>(null);

  if (wabas.length === 0) return null;

  function connect(wabaId: string) {
    setConnecting(wabaId);
    startTransition(async () => {
      const result = await connectDiscoveredWabaAction({ workspaceId, wabaId });
      setConnecting(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Conta conectada");
      router.refresh();
    });
  }

  return (
    <Card className="border-amber-line bg-amber-soft/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <PlugZap className="size-4 text-amber" />
          {wabas.length === 1 ? "Uma conta sem cliente" : `${wabas.length} contas sem cliente`}
        </CardTitle>
        <CardDescription>
          Estas contas existem na sua Meta e não estão ligadas a nenhum cliente aqui — o
          cadastro foi concluído lá e se perdeu no caminho. Conectar liga a conta a{" "}
          <strong className="text-ink">{workspaceName}</strong>, sem o cliente refazer nada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {wabas.map((waba) => (
          <div
            key={waba.wabaId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-card px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {waba.name ?? `Conta ${waba.wabaId}`}
              </p>
              <p className="truncate text-xs text-ink-2">
                {waba.phones.map((p) => p.display).join(" · ")}
                {waba.ownerBusinessName ? ` · ${waba.ownerBusinessName}` : ""}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => connect(waba.wabaId)}
              disabled={isPending}
            >
              {connecting === waba.wabaId && <Loader2 className="size-4 animate-spin" />}
              Conectar a este cliente
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
