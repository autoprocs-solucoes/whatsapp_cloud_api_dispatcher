"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Paperclip, Send, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendMediaReplyAction, sendReplyAction } from "@/features/inbox/actions";
import { webmToOgg } from "@/lib/audio/webm-to-ogg";
import type { Window24h } from "@/server/inbox";
import { cn } from "@/lib/utils";

type Props = {
  phone: string;
  window: Window24h;
};

/**
 * Campo de resposta. Quando a janela de 24h fecha, some e dá o caminho certo —
 * enviar texto livre ali seria aceito pela Meta e descartado em seguida, com o
 * atendente achando que falou com o cliente.
 */
/**
 * Formatos de gravação, em ordem de preferência.
 *
 * Nenhum navegador grava direto no que a Meta quer em todos os casos: o
 * Firefox faz ogg/opus, o Chrome só webm/opus ou um MP4 fragmentado que a
 * Cloud API rejeita ("on processing it is of type application/octet-stream").
 * Por isso o webm é aceito aqui e convertido pra ogg antes de subir — mesma
 * trilha de áudio, só troca a embalagem.
 */
const RECORD_FORMATS: { mimeType: string; ext: string; voice: boolean; convert: boolean }[] = [
  { mimeType: "audio/ogg;codecs=opus", ext: "ogg", voice: true, convert: false },
  { mimeType: "audio/ogg", ext: "ogg", voice: true, convert: false },
  { mimeType: "audio/webm;codecs=opus", ext: "ogg", voice: true, convert: true },
  { mimeType: "audio/mpeg", ext: "mp3", voice: false, convert: false },
  { mimeType: "audio/mp4;codecs=mp4a.40.2", ext: "m4a", voice: false, convert: false },
  { mimeType: "audio/mp4", ext: "m4a", voice: false, convert: false },
];

function pickRecordFormat() {
  if (typeof MediaRecorder === "undefined") return null;
  return RECORD_FORMATS.find((f) => MediaRecorder.isTypeSupported(f.mimeType)) ?? null;
}

export function ReplyForm({ phone, window: win }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Arquivo escolhido esperando confirmação — anexo não sai por engano. */
  const [pending, setPending] = useState<{ file: File; previewUrl: string | null } | null>(null);
  const [pendingCaption, setPendingCaption] = useState("");

  // Se a pessoa sair da conversa no meio da gravação, o microfone tem que
  // fechar junto — senão o indicador do navegador fica aceso pra sempre.
  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // A prévia é um object URL; sem revogar, fica preso na memória da aba.
  useEffect(() => {
    return () => {
      if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    };
  }, [pending]);

  function choose(file: File) {
    setPendingCaption(text.trim());
    setPending({
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    });
  }

  function discardPending() {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
    setPendingCaption("");
  }

  if (win.open === false) {
    return (
      <div className="shrink-0 space-y-2 bg-amber-soft px-4 py-3">
        <p className="text-[13px] font-semibold text-amber">Janela de 24 horas fechada</p>
        <p className="text-xs text-ink-2">
          O contato não escreve desde{" "}
          {win.lastInboundAt
            ? new Date(win.lastInboundAt).toLocaleString("pt-BR")
            : "muito tempo"}
          . Fora dessa janela o WhatsApp só entrega template aprovado; texto livre é aceito e
          descartado sem aviso.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/transmissao/nova">Retomar com um template</Link>
        </Button>
      </div>
    );
  }

  function sendMedia(file: File, opts: { voice?: boolean; caption?: string } = {}) {
    const fd = new FormData();
    fd.append("phone", phone);
    fd.append("file", file);
    if (opts.voice) fd.append("voice", "1");
    // Legenda vem do campo do diálogo (ou do texto já digitado, que ele
    // herda ao abrir).
    const caption = opts.caption ?? "";
    if (caption && !opts.voice) fd.append("caption", caption);

    setBusy(true);
    startTransition(async () => {
      const res = await sendMediaReplyAction(fd);
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setText("");
      discardPending();
      router.refresh();
    });
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }

    try {
      const format = pickRecordFormat();
      if (!format) {
        toast.error(
          "Este navegador não grava em nenhum formato que o WhatsApp aceita. Use o clipe pra anexar um áudio.",
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: format.mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);

        const blob = new Blob(chunksRef.current, { type: format.mimeType });
        if (blob.size === 0) return;

        if (!format.convert) {
          sendMedia(new File([blob], `audio.${format.ext}`, { type: format.mimeType.split(";")[0] }), {
            voice: format.voice,
          });
          return;
        }

        const ogg = webmToOgg(new Uint8Array(await blob.arrayBuffer()));
        if (!ogg) {
          toast.error("Não consegui preparar o áudio gravado. Tente de novo.");
          return;
        }
        // `new Uint8Array(ogg)` copia pro buffer que o File aceita — o
        // TypeScript não garante que o original não seja compartilhado.
        const file = new File([new Uint8Array(ogg).buffer], "audio.ogg", { type: "audio/ogg" });
        sendMedia(file, { voice: true });
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Não consegui acessar o microfone. Autorize o acesso no navegador.");
    }
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
    <div className="shrink-0 space-y-1.5 bg-wa-panel px-4 py-2.5">
      {win.open === null && (
        <p className="text-[11px] text-wa-ink-2">
          Sem histórico de mensagens recebidas deste contato. Não dá pra confirmar se a janela de
          24 horas está aberta.
        </p>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/3gpp,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) choose(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending || busy || recording}
          aria-label="Anexar arquivo"
          title="Anexar arquivo"
          className="flex size-[42px] shrink-0 items-center justify-center rounded-full text-wa-ink-2 transition-colors hover:bg-wa-active hover:text-wa-ink disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Paperclip className="size-5" />}
        </button>
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
          rows={1}
          maxLength={4096}
          placeholder="Digite uma mensagem"
          aria-label="Resposta"
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border-0 bg-wa-in px-4 py-2.5 text-[15px] leading-tight text-wa-ink outline-none placeholder:text-wa-ink-2 focus-visible:ring-2 focus-visible:ring-wa-accent"
        />
        {text.trim() ? (
          <button
            type="button"
            onClick={submit}
            disabled={isPending || busy}
            aria-label="Enviar"
            title="Enviar"
            className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-wa-accent text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="size-5" />
          </button>
        ) : (
          // Sem texto o botão vira microfone, como no WhatsApp: gravou, soltou,
          // já foi.
          <button
            type="button"
            onClick={toggleRecording}
            disabled={busy}
            aria-label={recording ? "Parar e enviar áudio" : "Gravar áudio"}
            title={recording ? "Parar e enviar" : "Gravar áudio"}
            className={cn(
              "flex size-[42px] shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-40",
              recording ? "animate-pulse bg-red" : "bg-wa-accent",
            )}
          >
            {recording ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
          </button>
        )}
      </div>
      {pending && (
        <div className="space-y-2 rounded-lg border border-wa-line bg-wa-in p-3">
          <div className="flex items-center gap-3">
            {pending.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pending.previewUrl}
                alt=""
                className="size-16 shrink-0 rounded-md object-cover"
              />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-wa-panel text-wa-ink-2">
                <Paperclip className="size-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-wa-ink">{pending.file.name}</p>
              <p className="text-[11px] text-wa-ink-2">
                {(pending.file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                {pending.file.type || "tipo desconhecido"}
              </p>
            </div>
          </div>

          <input
            value={pendingCaption}
            onChange={(e) => setPendingCaption(e.target.value)}
            placeholder="Legenda (opcional)"
            aria-label="Legenda do anexo"
            className="h-9 w-full rounded-lg border-0 bg-wa-panel px-3 text-[14px] text-wa-ink outline-none placeholder:text-wa-ink-2 focus-visible:ring-2 focus-visible:ring-wa-accent"
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={discardPending} disabled={busy}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => sendMedia(pending.file, { caption: pendingCaption.trim() })}
            >
              {busy && <Loader2 className="size-3.5 animate-spin" />} Enviar arquivo
            </Button>
          </div>
        </div>
      )}

      {recording && (
        <p className="text-[11px] text-red">Gravando… toque no quadrado pra parar e enviar.</p>
      )}
      {win.hoursLeft !== null && win.hoursLeft <= 4 && (
        <p className="text-[11px] text-amber">A janela fecha em cerca de {win.hoursLeft}h.</p>
      )}
    </div>
  );
}
