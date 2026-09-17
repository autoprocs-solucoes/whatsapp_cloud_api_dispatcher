"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendReplyAction } from "@/features/inbox/actions";
import type { Window24h } from "@/server/inbox";

type Props = {
  phone: string;
  window: Window24h;
};

/**
 * Campo de resposta. Quando a janela de 24h fecha, some e dá o caminho certo —
 * enviar texto livre ali seria aceito pela Meta e descartado em seguida, com o
 * atendente achando que falou com o cliente.
 */
export function ReplyForm({ phone, window: win }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  if (win.open === false) {
    return (
      <div className="space-y-2 border-t border-line bg-amber-soft px-4 py-3">
        <p className="text-[13px] font-semibold text-amber">Janela de 24 horas fechada</p>
        <p className="text-xs text-ink-2">
          O contato não escreve desde{" "}
          {win.lastInboundAt
            ? new Date(win.lastInboundAt).toLocaleString("pt-BR")
            : "muito tempo"}
          . Fora dessa janela o WhatsApp só entrega template aprovado — texto livre é aceito e
          descartado sem aviso.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/comunicados/novo">Retomar com um template</Link>
        </Button>
      </div>
    );
  }

  function submit() {
    const value = text.trim();
    if (!value || isPending) return;

    const fd = new FormData();
    fd.append("phone", phone);
    fd.append("text", value);

    startTransition(async () => {
      const res = await sendReplyAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setText("");
      areaRef.current?.focus();
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 border-t border-line bg-card p-3">
      {win.open === null && (
        <p className="text-[11px] text-ink-3">
          Sem histórico de mensagens recebidas deste contato — não dá pra confirmar se a janela de
          24 horas está aberta.
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia, Shift+Enter quebra linha.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          maxLength={4096}
          placeholder="Escreva uma resposta… (Enter envia, Shift+Enter quebra linha)"
          aria-label="Resposta"
          className="min-h-[44px] flex-1 resize-y rounded-md border border-line-2 bg-card px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-line"
        />
        <Button onClick={submit} disabled={isPending || !text.trim()} size="sm">
          <Send className="size-4" />
          {isPending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
      {win.hoursLeft !== null && win.hoursLeft <= 4 && (
        <p className="text-[11px] text-amber">
          A janela fecha em cerca de {win.hoursLeft}h.
        </p>
      )}
    </div>
  );
}
