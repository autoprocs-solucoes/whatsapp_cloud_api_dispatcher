"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailOpen } from "lucide-react";
import { toast } from "sonner";

import { markThreadUnreadAction } from "@/features/inbox/actions";

/**
 * Marca a conversa como não lida e sai dela. Sair é parte do comportamento:
 * abrir a conversa marca como lida, então continuar ali desfaria o clique.
 */
export function MarkUnreadButton({ phone }: { phone: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await markThreadUnreadAction(phone);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Marcada como não lida");
      router.push("/conversas?fechado=1");
      // Sem o refresh a lista vem do cache do router e o selo de não lida não
      // aparece — foi o "cliquei e não aconteceu nada".
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label="Marcar como não lida"
      title="Marcar como não lida"
      className="flex size-8 items-center justify-center rounded-full text-wa-ink-2 transition-colors hover:bg-wa-active hover:text-wa-ink disabled:opacity-50"
    >
      <MailOpen className="size-4.5" />
    </button>
  );
}
