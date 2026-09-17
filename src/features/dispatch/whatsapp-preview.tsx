"use client";

import { ChevronLeft, Plus, Video } from "lucide-react";

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
  /** Override do tamanho da área de chat (default: min-h-[120px] max-h-[260px]). */
  chatClassName?: string;
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
        <span key={`f-${i}`} className="rounded bg-amber-soft px-0.5 text-ink">
          {val}
        </span>,
      );
    } else {
      const label = labels[key] ?? `{{${num}}}`;
      parts.push(
        <span
          key={`p-${i}`}
          className="rounded border border-brand-line bg-brand-soft px-1 font-mono text-[11px] font-medium text-brand-strong"
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

/** Barra de status do iOS: relógio à esquerda, sinal/wi-fi/bateria à direita. */
function StatusBar() {
  return (
    <div className="relative z-10 flex h-[26px] items-center justify-between px-5 text-[10px] font-semibold text-wa-ink">
      <span className="tabular-nums">{nowLabel()}</span>
      <span className="flex items-center gap-1" aria-hidden>
        {/* Sinal: quatro barras crescentes. */}
        <span className="flex items-end gap-[1.5px]">
          {[3, 4.5, 6, 7.5].map((h) => (
            <span
              key={h}
              className="w-[2.5px] rounded-[1px] bg-current"
              style={{ height: `${h}px` }}
            />
          ))}
        </span>
        {/* Wi-Fi: três arcos. */}
        <svg width="12" height="9" viewBox="0 0 16 12" fill="none" className="text-current">
          <path
            d="M8 10.2a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z"
            fill="currentColor"
          />
          <path
            d="M4.6 7.1a5 5 0 0 1 6.8 0M2.1 4.4a8.6 8.6 0 0 1 11.8 0"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        {/* Bateria: casco com carga e o pino da direita. */}
        <span className="flex items-center gap-[1px]">
          <span className="relative h-[9px] w-[18px] rounded-[3px] border border-current opacity-90">
            <span className="absolute inset-[1.5px] right-[4px] rounded-[1px] bg-current" />
          </span>
          <span className="h-[3px] w-[1.5px] rounded-r-[1px] bg-current opacity-60" />
        </span>
      </span>
    </div>
  );
}

/**
 * Prévia do template dentro de um iPhone, com a interface do WhatsApp do iOS.
 *
 * A moldura existe pra dar escala: o cliente precisa ver quanto do texto cabe
 * na tela de quem recebe, e um retângulo solto não comunica isso. Por isso a
 * largura imita a de um aparelho real em vez de esticar no container.
 */
export function WhatsAppPreview({
  senderName,
  headerText,
  bodyText,
  footerText,
  buttons,
  resolved = {},
  placeholderLabels = {},
  className,
  chatClassName,
}: Props) {
  const hasContent = Boolean(headerText || bodyText || footerText || (buttons && buttons.length > 0));
  const initials = (senderName ?? "Empresa").slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        // Corpo do aparelho: titânio escuro, borda fina clara imitando o
        // chanfro da lateral, e sombra baixa pra assentar no card.
        "relative mx-auto w-full max-w-[270px] rounded-[2.75rem] bg-neutral-900 p-[10px]",
        "shadow-[0_18px_40px_-12px_rgba(11,20,26,0.55)] ring-1 ring-white/10",
        className,
      )}
    >
      {/* Botões laterais: volume à esquerda, ação/power à direita. */}
      <span
        aria-hidden
        className="absolute top-[110px] -left-[2px] h-8 w-[3px] rounded-l-sm bg-neutral-700"
      />
      <span
        aria-hidden
        className="absolute top-[152px] -left-[2px] h-8 w-[3px] rounded-l-sm bg-neutral-700"
      />
      <span
        aria-hidden
        className="absolute top-[130px] -right-[2px] h-12 w-[3px] rounded-r-sm bg-neutral-700"
      />

      <div className="relative overflow-hidden rounded-[2.1rem] bg-wa-panel">
        {/* Dynamic Island, sobreposta à barra de status. */}
        <span
          aria-hidden
          className="absolute top-[7px] left-1/2 z-20 h-[20px] w-[72px] -translate-x-1/2 rounded-full bg-black"
        />

        <StatusBar />

        {/* Cabeçalho do WhatsApp no iOS: claro, nome centralizado. */}
        <div className="flex items-center gap-1.5 border-b border-wa-line bg-wa-panel px-2 pt-0.5 pb-1.5">
          <ChevronLeft className="size-4 shrink-0 text-wa-accent" />
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-wa-active text-[10px] font-semibold text-wa-ink-2">
            {initials}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold text-wa-ink">
              {senderName ?? "Empresa"}
            </p>
            <p className="text-[10px] text-wa-ink-2">online</p>
          </div>
          <Video className="size-4 shrink-0 text-wa-accent" />
        </div>

        {/* Conversa */}
        <div
          className={cn(
            "no-scrollbar overflow-y-auto bg-wa-bg px-3 py-2.5",
            chatClassName ?? "max-h-[300px] min-h-[140px]",
          )}
        >
          {!hasContent ? (
            <p className="mt-12 text-center text-xs text-wa-ink-2">
              Selecione um template pra visualizar.
            </p>
          ) : (
            <div className="flex flex-col items-start gap-1">
              <div className="relative max-w-[88%] rounded-[7.5px] rounded-tl-none bg-wa-in px-2 py-1.5 text-[13px] leading-[18px] text-wa-ink shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
                <span
                  aria-hidden
                  className="absolute top-0 -left-[7px] size-0 border-[5px] border-transparent border-t-wa-in border-r-wa-in"
                />

                {headerText && (
                  <p className="mb-1 leading-snug font-semibold">
                    {renderText(headerText, "header", resolved, placeholderLabels)}
                  </p>
                )}

                {bodyText && (
                  <p className="leading-snug whitespace-pre-wrap">
                    {renderText(bodyText, "body", resolved, placeholderLabels)}
                  </p>
                )}

                {footerText && <p className="mt-1 text-[11px] text-wa-ink-2">{footerText}</p>}

                <span className="mt-0.5 flex items-center justify-end text-[10px] text-wa-ink-2">
                  {nowLabel()}
                </span>
              </div>

              {buttons && buttons.length > 0 && (
                <div className="w-[88%] space-y-[3px]">
                  {buttons.map((b, i) => (
                    <div
                      key={`${b.text}-${i}`}
                      className="w-full rounded-[7.5px] bg-wa-in py-1.5 text-center text-[12px] font-medium text-wa-accent shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]"
                    >
                      {b.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Campo de mensagem + indicador de home do iPhone. */}
        <div className="bg-wa-panel px-2 pt-1.5 pb-1">
          <div className="flex items-center gap-1.5">
            <Plus className="size-4 shrink-0 text-wa-accent" />
            <div className="flex-1 rounded-full border border-wa-line bg-wa-in px-2.5 py-[3px] text-[11px] text-wa-ink-2">
              Mensagem
            </div>
          </div>
          <span
            aria-hidden
            className="mx-auto mt-1.5 block h-[3px] w-[90px] rounded-full bg-wa-ink opacity-30"
          />
        </div>
      </div>
    </div>
  );
}
