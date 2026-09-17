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

function StatusTicks({ status }: { status: WhatsappMessage["status"] }) {
  if (status === "failed") {
    return <TriangleAlert className="size-3 text-red" aria-label="Falhou" />;
  }
  if (status === "read") {
    return <CheckCheck className="size-3 text-brand-2" aria-label="Lida" />;
  }
  if (status === "delivered") {
    return <CheckCheck className="size-3 opacity-70" aria-label="Entregue" />;
  }
  if (status === "sent") {
    return <Check className="size-3 opacity-70" aria-label="Enviada" />;
  }
  return <Clock className="size-3 opacity-70" aria-label="Enviando" />;
}

export function MessageBubble({ message }: { message: WhatsappMessage }) {
  const isOut = message.direction === "out";
  const Icon = MEDIA_ICON[message.type];
  const isImage = message.type === "image" || message.type === "sticker";
  const label = TYPE_LABEL[message.type];

  return (
    <div className={cn("flex", isOut ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(75%,30rem)] space-y-1.5 rounded-lg px-3 py-2 text-[13px] shadow-card",
          isOut
            ? "rounded-br-sm border border-brand-line bg-brand-soft text-ink"
            : "rounded-bl-sm border border-line bg-card text-ink",
        )}
      >
        {isImage && message.media_id && (
          // A mídia é servida por uma rota autenticada do próprio app: o
          // otimizador do next/image roda fora da sessão e receberia 404.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/conversas/midia/${message.media_id}`}
            alt={message.body ?? label ?? "Imagem recebida"}
            className="max-h-64 w-auto rounded-md border border-line object-contain"
            loading="lazy"
          />
        )}

        {!isImage && Icon && (
          <a
            href={message.media_id ? `/conversas/midia/${message.media_id}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              message.media_id ? "text-brand hover:underline" : "text-ink-2",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {label ?? message.type}
          </a>
        )}

        {message.body ? (
          <p className="break-words whitespace-pre-wrap">{message.body}</p>
        ) : (
          !Icon && <p className="text-ink-3 italic">{label ?? message.type}</p>
        )}

        <div
          className={cn(
            "flex items-center gap-1 text-[10px] text-ink-3",
            isOut ? "justify-end" : "justify-start",
          )}
        >
          <span className="font-mono">
            {new Date(message.sent_at).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isOut && <StatusTicks status={message.status} />}
        </div>

        {message.error_message && (
          <p className="text-[10px] leading-snug text-red">{message.error_message}</p>
        )}
      </div>
    </div>
  );
}
