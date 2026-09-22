import {
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Headphones,
  ImageIcon,
  MapPin,
  TriangleAlert,
  Video,
} from "lucide-react";

import { formatTimeBR } from "@/lib/format/datetime";
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
  const isAudio = message.type === "audio";
  /** Documento e afins mostram o nome dentro do cartão. */
  const isDocumentCard = !isImage && !isAudio && Boolean(MEDIA_ICON[message.type]);
  const label = TYPE_LABEL[message.type];

  const time = formatTimeBR(message.sent_at);

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

        {isAudio && message.media_id && (
          // Player no lugar de link: áudio é pra ouvir ali mesmo, sem abrir
          // outra aba. O arquivo vem pela rota autenticada do app.
          <audio
            controls
            preload="none"
            src={`/conversas/midia/${message.media_id}`}
            className="mb-1 h-10 w-[240px] max-w-full"
          />
        )}

        {!isImage && !isAudio && Icon && (
          // Cartão de arquivo em vez de uma linha só: o nome vem no corpo da
          // mensagem, e sem isso a bolha virava um tracinho com o ícone.
          <a
            href={message.media_id ? `/conversas/midia/${message.media_id}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            download
            className={cn(
              "mb-1 flex items-center gap-2.5 rounded-[6px] bg-black/5 px-2.5 py-2",
              message.media_id ? "hover:bg-black/10" : "opacity-70",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-wa-panel text-wa-ink-2">
              <Icon className="size-4.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-wa-ink">
                {message.body || label || message.type}
              </span>
              <span className="block text-[11px] text-wa-ink-2">
                {label ?? message.type}
                {message.media_id ? " · toque pra baixar" : ""}
              </span>
            </span>
            {message.media_id && <Download className="size-4 shrink-0 text-wa-ink-2" aria-hidden />}
          </a>
        )}

        {message.status === "failed" && message.error_message && (
          <p className="mb-1 rounded-[6px] bg-red-soft px-2 py-1.5 text-[11px] text-red">
            {message.error_message}
          </p>
        )}

        {message.body && !isDocumentCard ? (
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
