"use client";

import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  iconClassName?: string;
};

const COPY = "Só conta destinatários com confirmação de leitura ativada no WhatsApp. Quem desativou aparece como 'entregue' mesmo lendo a mensagem.";

export function ReadRateInfo({ className, iconClassName }: Props) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Sobre a taxa de leitura"
            className={cn(
              "text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-full p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            <Info className={cn("size-3", iconClassName)} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          className="max-w-xs whitespace-normal text-pretty leading-snug"
        >
          <div className="space-y-1">
            <p className="text-[11px] font-semibold">Sobre a taxa de leitura</p>
            <p className="text-[11px] opacity-90">{COPY}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
