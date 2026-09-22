"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Clock, FileText, Image as ImageIcon, List, Play, Video } from "lucide-react";

import { WhatsAppMark } from "@/components/whatsapp-mark";
import { NEXT_HANDLE, type DelayNodeData, type MessageNodeData, type StartNodeData } from "@/features/flows/schemas";
import { cn } from "@/lib/utils";

/**
 * Nós do canvas. Cada saída é um `Handle` de origem: o bloco sem botões tem a
 * saída única "next"; com botões, cada botão puxa a sua — é assim que o fluxo
 * ramifica pela resposta de quem recebeu.
 */

const MEDIA_ICON = {
  image: ImageIcon,
  video: Video,
  document: FileText,
} as const;

/** Bolinha azul na borda direita, igual à do vídeo. */
function OutHandle({ id, className }: { id: string; className?: string }) {
  return (
    <Handle
      type="source"
      position={Position.Right}
      id={id}
      className={cn(
        "!size-4 !border-2 !border-white !bg-brand shadow-sm",
        "!right-[-8px]",
        className,
      )}
    />
  );
}

function InHandle() {
  return (
    <Handle
      type="target"
      position={Position.Left}
      className="!size-4 !border-2 !border-white !bg-brand !left-[-8px] shadow-sm"
    />
  );
}

function NodeShell({
  selected,
  children,
  className,
}: {
  selected?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-[260px] rounded-xl border bg-card shadow-card transition-colors",
        selected ? "border-brand ring-2 ring-brand/30" : "border-line",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StartNode({ data, selected }: NodeProps<Node<StartNodeData>>) {
  return (
    <NodeShell selected={selected} className="w-[180px]">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex size-6 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Play className="size-3.5" />
        </span>
        <span className="text-sm font-semibold text-ink">{data.label || "Início"}</span>
      </div>
      <OutHandle id={NEXT_HANDLE} />
    </NodeShell>
  );
}

export function MessageNode({ data, selected }: NodeProps<Node<MessageNodeData>>) {
  const MediaIcon = data.media ? MEDIA_ICON[data.media.type] : null;
  const asList = data.buttons.length > 3;

  return (
    <NodeShell selected={selected}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <WhatsAppMark className="size-4" />
        <span className="text-[13px] font-semibold text-ink">Enviar mensagem</span>
      </div>

      <div className="space-y-2 p-3">
        {MediaIcon && (
          <div className="flex items-center gap-1.5 rounded-md bg-ok-soft px-2 py-1.5 text-[11px] text-ok-ink">
            <MediaIcon className="size-3.5" />
            <span className="truncate">{data.media?.filename || data.media?.url}</span>
          </div>
        )}

        {data.title && <p className="text-[13px] font-semibold text-ink">{data.title}</p>}

        <p
          className={cn(
            "rounded-md bg-ok-soft px-2.5 py-2 text-[12px] whitespace-pre-wrap text-ink",
            !data.body && "text-ink-4 italic",
          )}
        >
          {data.body || "Insira o seu texto"}
        </p>

        {data.footer && <p className="text-[11px] text-ink-3">{data.footer}</p>}

        {asList && (
          <div className="flex items-center justify-center gap-1.5 rounded-md border border-line-2 py-1.5 text-[12px] font-medium text-ok-ink">
            <List className="size-3.5" /> {data.listTitle || "Ver opções"}
          </div>
        )}
      </div>

      {data.buttons.length > 0 ? (
        <div className="border-t border-line">
          {data.buttons.map((b) => (
            <div
              key={b.id}
              className="relative border-b border-line px-3 py-2 text-center text-[12px] font-medium text-ok-ink last:border-b-0"
            >
              {b.label || "Botão"}
              <OutHandle id={b.id} className="!top-1/2 !-translate-y-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative flex items-center justify-end gap-1 border-t border-line px-3 py-2 text-[11px] text-ink-3">
          Próximo passo
          <OutHandle id={NEXT_HANDLE} className="!top-1/2 !-translate-y-1/2" />
        </div>
      )}

      <InHandle />
    </NodeShell>
  );
}

const UNIT_LABEL: Record<DelayNodeData["unit"], string> = {
  minutes: "minutos",
  hours: "horas",
  days: "dias",
};

export function DelayNode({ data, selected }: NodeProps<Node<DelayNodeData>>) {
  return (
    <NodeShell selected={selected} className="w-[230px]">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-amber-soft text-amber">
          <Clock className="size-3.5" />
        </span>
        <span className="text-[13px] font-semibold text-ink">Atraso inteligente</span>
      </div>

      <div className="relative px-3 py-2.5">
        <p className="rounded-md bg-amber-soft px-2.5 py-2 text-[12px] text-ink-2">
          {data.mode === "duration" ? (
            <>
              Continua para o próximo bloco após{" "}
              <strong className="text-ink">
                {data.amount} {UNIT_LABEL[data.unit]}
              </strong>
            </>
          ) : data.at ? (
            <>
              Continua em{" "}
              <strong className="text-ink">
                {new Date(data.at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
            </>
          ) : (
            "Defina a data e a hora"
          )}
        </p>
        <OutHandle id={NEXT_HANDLE} className="!top-1/2 !-translate-y-1/2" />
      </div>

      <InHandle />
    </NodeShell>
  );
}

export const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  delay: DelayNode,
};
