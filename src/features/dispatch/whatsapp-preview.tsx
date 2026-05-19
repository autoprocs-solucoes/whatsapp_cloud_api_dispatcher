"use client";

import { ArrowLeft, Camera, Check, MoreVertical, Phone, Video } from "lucide-react";

import { cn } from "@/lib/utils";

export type PreviewButton = {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE" | string;
  text: string;
};

type Props = {
  senderName?: string | null;
  headerText?: string | null;
  bodyText?: string | null;
  footerText?: string | null;
  buttons?: PreviewButton[];
  /** Valores resolvidos por chave "header:N" / "body:N". Faltantes ficam como [coluna] highlight. */
  resolved?: Record<string, string>;
  /** Para placeholders sem valor, mostrar este label (ex: nome da coluna). Por placeholder. */
  placeholderLabels?: Record<string, string>;
  className?: string;
};

function renderText(
  text: string,
  component: "header" | "body",
  resolved: Record<string, string>,
  labels: Record<string, string>,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\{\{\s*([a-zA-Z_]\w*|\d+)\s*\}\}/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index));
    }
    const num = m[1]!;
    const key = `${component}:${num}`;
    const val = resolved[key];
    if (val && val.length > 0) {
      parts.push(
        <span key={`f-${i}`} className="rounded bg-amber-200/40 px-0.5 dark:bg-amber-500/20">
          {val}
        </span>,
      );
    } else {
      const label = labels[key] ?? `{{${num}}}`;
      parts.push(
        <span
          key={`p-${i}`}
          className="rounded bg-blue-200/40 px-1 text-xs font-medium text-blue-900 dark:bg-blue-500/20 dark:text-blue-200"
        >
          {label}
        </span>,
      );
    }
    lastIndex = re.lastIndex;
    i++;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function WhatsAppPreview({
  senderName,
  headerText,
  bodyText,
  footerText,
  buttons,
  resolved = {},
  placeholderLabels = {},
  className,
}: Props) {
  const hasContent = Boolean(headerText || bodyText || footerText || (buttons && buttons.length > 0));

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl border-[6px] border-neutral-900 shadow-xl",
        "bg-[#e8e0d3] dark:bg-[#0b141a]",
        className,
      )}
    >
      {/* WhatsApp top bar */}
      <div className="flex items-center gap-2 bg-[#075e54] px-3 py-1.5 text-white dark:bg-[#1f2c33]">
        <ArrowLeft className="size-4 opacity-80" />
        <div className="bg-primary/30 flex size-7 items-center justify-center rounded-full bg-white/20 text-[10px] font-semibold uppercase">
          {(senderName ?? "AP").slice(0, 2)}
        </div>
        <div className="flex-1 leading-tight">
          <p className="text-sm font-medium">{senderName ?? "Empresa"}</p>
          <p className="text-[10px] opacity-80">online</p>
        </div>
        <Video className="size-4 opacity-80" />
        <Phone className="size-4 opacity-80" />
        <MoreVertical className="size-4 opacity-80" />
      </div>

      {/* Chat area */}
      <div
        className="relative max-h-[260px] min-h-[120px] overflow-y-auto px-2.5 py-2"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 15%, rgba(0,0,0,0.04) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.04) 0, transparent 40%)",
        }}
      >
        {!hasContent ? (
          <p className="text-muted-foreground mt-12 text-center text-xs">
            Selecione um template pra visualizar.
          </p>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <div className="relative max-w-[85%] rounded-lg rounded-tl-none bg-white px-2.5 py-2 text-sm text-neutral-900 shadow-sm dark:bg-[#202c33] dark:text-neutral-100">
              {/* tail */}
              <span
                className="absolute -left-1.5 top-0 size-0 border-y-[6px] border-r-[8px] border-y-transparent border-r-white dark:border-r-[#202c33]"
                aria-hidden
              />

              {headerText && (
                <p className="mb-1 font-semibold leading-snug">
                  {renderText(headerText, "header", resolved, placeholderLabels)}
                </p>
              )}

              {bodyText && (
                <p className="whitespace-pre-wrap leading-snug">
                  {renderText(bodyText, "body", resolved, placeholderLabels)}
                </p>
              )}

              {footerText && (
                <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                  {footerText}
                </p>
              )}

              <span className="mt-1 flex items-center justify-end gap-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                {nowLabel()}
                <Check className="size-3" />
              </span>
            </div>

            {buttons && buttons.length > 0 && (
              <div className="mt-1 w-[85%] space-y-1">
                {buttons.map((b, i) => (
                  <button
                    key={`${b.text}-${i}`}
                    type="button"
                    disabled
                    className="w-full rounded-md bg-white px-2 py-1.5 text-xs font-medium text-[#00a884] shadow-sm dark:bg-[#202c33] dark:text-[#53bdeb]"
                  >
                    {b.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom input strip */}
      <div className="bg-[#f0f0f0] px-2 py-1.5 dark:bg-[#1f2c33]">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground flex-1 rounded-full bg-white px-3 py-1 text-[10px] dark:bg-[#2a3942] dark:text-neutral-400">
            Mensagem
          </div>
          <div className="flex size-5 items-center justify-center rounded-full bg-[#00a884] text-white">
            <Camera className="size-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
