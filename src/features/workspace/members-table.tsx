"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspaceRole } from "@/lib/supabase/database.types";

type Member = {
  user_id: string;
  full_name: string;
  email: string;
  role: WorkspaceRole;
  created_at: string;
};

type Props = {
  members: Member[];
  workspaceId: string;
  currentUserId: string;
  canManage: boolean;
  onRemove: (formData: FormData) => Promise<void>;
};

export function MembersTable({
  members,
  workspaceId,
  currentUserId,
  canManage,
  onRemove,
}: Props) {
  const [isPending, startTransition] = useTransition();

  function handleRemove(userId: string) {
    const fd = new FormData();
    fd.append("workspaceId", workspaceId);
    fd.append("userId", userId);
    startTransition(async () => {
      await onRemove(fd);
      toast.success("Membro removido");
    });
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isSelf = m.user_id === currentUserId;
            const canRemove = canManage && !isSelf && m.role !== "owner";
            return (
              <tr key={m.user_id} className="border-t">
                <td className="px-4 py-2">{m.full_name || "—"}</td>
                <td className="text-muted-foreground px-4 py-2">{m.email}</td>
                <td className="px-4 py-2">
                  <Badge variant={m.role === "owner" ? "default" : "secondary"}>{m.role}</Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  {canRemove && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Remover membro">
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {m.email} perderá acesso ao workspace. Pode ser convidado novamente
                            depois.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={isPending}
                            onClick={() => handleRemove(m.user_id)}
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
