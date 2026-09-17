"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import type { WorkspaceRole } from "@/lib/supabase/database.types";

type Member = {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
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

function initials(member: Member): string {
  return (member.full_name || member.email)
    .split(/[\s@._-]+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function MemberAvatar({
  member,
  onOpen,
}: {
  member: Member;
  onOpen: (member: Member) => void;
}) {
  if (!member.avatar_url) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-card-2 text-[10px] font-semibold text-ink-2">
        {initials(member)}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(member)}
      title="Ver foto"
      className="shrink-0 rounded-md transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    >
      <Image
        src={member.avatar_url}
        alt={`Foto de ${member.full_name || member.email}`}
        width={32}
        height={32}
        className="size-8 rounded-md object-cover"
      />
    </button>
  );
}

export function MembersTable({
  members,
  workspaceId,
  currentUserId,
  canManage,
  onRemove,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [viewing, setViewing] = useState<Member | null>(null);

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
    <>
      <TableShell>
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Membro</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead className="text-right" />
            </tr>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              const canRemove = canManage && !isSelf && m.role !== "owner";
              return (
                <TableRow key={m.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <MemberAvatar member={m} onOpen={setViewing} />
                      <span className="font-medium text-ink">
                        {m.full_name || "Sem nome"}
                        {isSelf && <span className="ml-1.5 text-xs text-ink-3">(você)</span>}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-ink-2">{m.email}</TableCell>
                  <TableCell>
                    <Badge variant={m.role === "owner" ? "owner" : "secondary"}>{m.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canRemove && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Remover membro">
                            <Trash2 className="size-3.5" />
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableShell>

      {/* Visualizador da foto — abre em tamanho grande a partir do avatar. */}
      <AlertDialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{viewing?.full_name || viewing?.email}</AlertDialogTitle>
            <AlertDialogDescription>{viewing?.email}</AlertDialogDescription>
          </AlertDialogHeader>
          {viewing?.avatar_url && (
            <Image
              src={viewing.avatar_url}
              alt={`Foto de ${viewing.full_name || viewing.email}`}
              width={320}
              height={320}
              className="mx-auto max-h-[320px] w-auto rounded-lg border border-line object-contain"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
