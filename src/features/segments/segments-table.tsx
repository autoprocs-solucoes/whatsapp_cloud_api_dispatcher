"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
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
import { deleteSegmentAction, type SegmentWithCount } from "@/features/segments/actions";
import { rulesSchema, type Rules } from "@/features/segments/schemas";
import type { Segment } from "@/lib/supabase/database.types";

type Props = {
  segments: SegmentWithCount[];
};

function parseRules(raw: Segment["rules"]): Rules | null {
  try {
    return rulesSchema.parse(raw);
  } catch {
    return null;
  }
}

export function SegmentsTable({ segments }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(s: Segment) {
    const fd = new FormData();
    fd.append("id", s.id);
    startTransition(async () => {
      const res = await deleteSegmentAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Segmento excluído");
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-xs">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Nome</th>
            <th className="px-3 py-2 text-left font-medium">Contatos</th>
            <th className="px-3 py-2 text-left font-medium">Regras</th>
            <th className="px-3 py-2 text-left font-medium">Modo</th>
            <th className="px-3 py-2 text-left font-medium">Criado em</th>
            <th className="px-3 py-2 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => {
            const r = parseRules(s.rules);
            const count = r?.rules.length ?? 0;
            const match = r?.match ?? "and";
            return (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/segmentos/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">
                  {s.contact_count === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <Badge variant="outline" className="font-mono">
                      {s.contact_count.toLocaleString("pt-BR")}
                    </Badge>
                  )}
                </td>
                <td className="text-muted-foreground px-3 py-2 text-xs">
                  {count} regra{count === 1 ? "" : "s"}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {match}
                  </Badge>
                </td>
                <td className="text-muted-foreground px-3 py-2 text-xs">
                  {new Date(s.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="sm" title="Editar">
                      <Link href={`/segmentos/${s.id}`}>
                        <Pencil className="size-3.5" />
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Excluir"
                          disabled={isPending}
                        >
                          <Trash2 className="text-destructive size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir segmento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            &quot;{s.name}&quot; será removido. Comunicados que usam esse segmento
                            como referência continuam intactos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
