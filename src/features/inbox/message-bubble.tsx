import {
  Check,
  CheckCheck,
  Clock,
  FileText,
  Headphones,
  ImageIcon,
  MapPin,
  TriangleAlert,
  Video,
} from "lucide-react";

import type { WhatsappMessage } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const MEDIA_ICON: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Headphones,
  sticker: ImageIcon,
  document: FileText,
  location: MapPin,
};

/** Rótulo pro que não tem texto — sem isso a bolha ficaria vazia. */
const TYPE_LABEL: Record<string, string> = {
  image: "Imagem",
  video: "Vídeo",
  audio: "Áudio",
  sticker: "Figurinha",
  document: "Documento",
  location: "Localização",
  contacts: "Contato",
  unknown: "Mensagem não suportada",
};

/** Tiques do WhatsApp: um cinza, dois cinzas, dois azuis. */
function StatusTicks({ status }: { status: WhatsappMessage["status"] }) {
  if (status === "failed") {
    return <TriangleAlert className="size-3.5 text-red" aria-label="Falhou" />;
  }
  if (status === "read") {
    return <CheckCheck className="size-3.5 text-wa-tick" aria-label="Lida" />;
  }
  if (status === "delivered") {
    return <CheckCheck className="size-3.5 text-wa-ink-2" aria-label="Entregue" />;
  }
  if (status === "sent") {
    return <Check className="size-3.5 text-wa-ink-2" aria-label="Enviada" />;
  }
  return <Clock className="size-3 text-wa-ink-2" aria-label="Enviando" />;
}

export function MessageBubble({ message }: { message: WhatsappMessage }) {
  const isOut = message.direction === "out";
  const Icon = MEDIA_ICON[message.type];
  const isImage = message.type === "image" || message.type === "sticker";
  const label = TYPE_LABEL[message.type];

  const time = new Date(message.sent_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={cn("flex px-1", isOut ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          // O rabinho do WhatsApp é o canto de cima achatado do lado de quem
          // fala; o resto arredondado em 7.5px, como no original.
          "relative max-w-[min(75%,30rem)] rounded-[7.5px] px-2 py-1.5 text-[14.2px] leading-[19px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
          isOut ? "rounded-tr-none bg-wa-out" : "rounded-tl-none bg-wa-in",
          // Sem texto (mídia, figurinha) não há linha pra hora dividir, então
          // ela ganha uma faixa própria embaixo.
          !message.body && "pb-[20px]",
          "text-wa-ink",
        )}
      >
        {/* Rabinho triangular, desenhado com borda — acompanha a cor da bolha. */}
        <span
          aria-hidden
          className={cn(
            "absolute top-0 size-0 border-[6px] border-transparent",
            isOut
              ? "-right-[10px] border-t-wa-out border-l-wa-out"
              : "-left-[10px] border-t-wa-in border-r-wa-in",
          )}
        />

        {isImage && message.media_id && (
          // A mídia é servida por uma rota autenticada do próprio app: o
          // otimizador do next/image roda fora da sessão e receberia 404.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/conversas/midia/${message.media_id}`}
            alt={message.body ?? label ?? "Imagem recebida"}
            className="mb-1 max-h-72 w-auto rounded-[6px] object-contain"
            loading="lazy"
          />
        )}

        {!isImage && Icon && (
          <a
            href={message.media_id ? `/conversas/midia/${message.media_id}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mb-0.5 flex items-center gap-2 rounded-[6px] px-1 py-1 text-[13px] font-medium",
              message.media_id ? "text-wa-ink hover:underline" : "text-wa-ink-2",
            )}
          >
            <Icon className="size-4 shrink-0 text-wa-ink-2" aria-hidden />
            {label ?? message.type}
          </a>
        )}

        {message.body ? (
          // Técnica do próprio WhatsApp: a hora fica em posição absoluta no
          // canto e o texto carrega um espaçador invisível do tamanho dela.
          // Assim, em mensagem curta a hora divide a linha com o texto, e em
          // mensagem longa o texto quebra antes de passar por baixo dela.
          <p className="break-words whitespace-pre-wrap">
            {message.body}
            <span
              aria-hidden
              className={cn("inline-block", isOut ? "w-[62px]" : "w-[42px]")}
            />
          </p>
        ) : (
          !Icon && <p className="text-wa-ink-2 italic">{label ?? message.type}</p>
        )}

        <span
          className={cn(
            "absolute right-[7px] bottom-[3px] flex items-center gap-1 text-[11px] text-wa-ink-2",
          )}
        >
          {time}
          {isOut && <StatusTicks status={message.status} />}
        </span>

        {message.error_message && (
          <p className="pt-1 pr-14 text-[11px] leading-snug text-red">{message.error_message}</p>
        )}
      </div>
    </div>
  );
}
