"use client";

import { useTransition } from "react";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { demoteMasterMemberAction } from "@/features/master/actions";

type Props = { userId: string; name: string };

export function DemoteMasterMemberButton({ userId, name }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleDemote() {
    startTransition(async () => {
      const result = await demoteMasterMemberAction({ userId });
      if (result.ok) {
        toast.success("Acesso master removido");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending} className="text-destructive">
          <UserMinus className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover acesso master de {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Essa pessoa perde acesso a /master (visão de todos os clientes), mas continua com
            acesso normal aos workspaces que já é membro.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={handleDemote}>
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
