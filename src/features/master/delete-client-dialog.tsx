"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteClientWorkspaceAction } from "@/features/master/actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  name: string;
  memberCount: number;
  contactCount: number;
  totalSent: number;
};

/**
 * Confirmação de exclusão de cliente.
 *
 * Pede o nome digitado de propósito: é a única ação do painel sem volta, e o
 * clique errado apaga o histórico inteiro de uma operação.
 */
export function DeleteClientDialog({
  open,
  onOpenChange,
  workspaceId,
  name,
  memberCount,
  contactCount,
  totalSent,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [typed, setTyped] = useState("");

  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  function confirm() {
    startTransition(async () => {
      const result = await deleteClientWorkspaceAction({ workspaceId, confirmName: typed });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Cliente ${name} apagado`);
      onOpenChange(false);
      setTyped("");
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setTyped("");
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso não tem volta e não existe lixeira. Some tudo que é do cliente:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-1 rounded-md border border-line bg-card-2 p-3 text-sm text-ink-2">
          <li>
            <strong className="text-ink">{contactCount.toLocaleString("pt-BR")}</strong> contatos,
            com segmentos e etiquetas
          </li>
          <li>
            <strong className="text-ink">{totalSent.toLocaleString("pt-BR")}</strong> mensagens
            enviadas, com o histórico de cada transmissão
          </li>
          <li>Conversas, fluxos, campanhas e modelos espelhados</li>
          <li>A conexão com a Meta (a WABA em si continua na conta do cliente)</li>
          <li>
            O acesso de <strong className="text-ink">{memberCount}</strong>{" "}
            {memberCount === 1 ? "pessoa" : "pessoas"} a este workspace — as contas delas
            continuam existindo
          </li>
        </ul>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-name">
            Escreva <span className="font-mono text-ink">{name}</span> pra confirmar
          </Label>
          <Input
            id="confirm-name"
            value={typed}
            autoFocus
            onChange={(e) => setTyped(e.target.value)}
            placeholder={name}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="destructive" disabled={!matches || isPending} onClick={confirm}>
            {isPending && <Loader2 className="size-4 animate-spin" />} Apagar para sempre
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
