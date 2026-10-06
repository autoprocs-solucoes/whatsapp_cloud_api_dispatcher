"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeBR } from "@/lib/format/datetime";
import {
  inspectWebhookAction,
  repairWebhookAction,
  type WebhookStatus,
} from "@/features/master/webhook-actions";

/** A partir de quanto tempo sem evento nenhum isso vira problema. */
const SILENCIO_PREOCUPANTE_MS = 6 * 60 * 60 * 1000;

/**
 * Estado do webhook do app na Meta.
 *
 * Existe porque o Dispatcher passou quatro dias sem receber nada — nenhuma
 * entrega, nenhuma leitura, nenhuma resposta de cliente — e ninguém tinha
 * onde olhar. O sintoma aparecia longe da causa: disparos terminando
 * "100% enviadas, 0 entregues", e as respostas dos clientes só no celular.
 */
export function WebhookPanel() {
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [reparando, startRepair] = useTransition();

  async function carregar() {
    setCarregando(true);
    const r = await inspectWebhookAction();
    setCarregando(false);
    if (!r.ok) {
      setErro(r.error);
      setStatus(null);
      return;
    }
    setErro(null);
    setStatus(r.data);
  }

  useEffect(() => {
    void carregar();
  }, []);

  function reparar() {
    startRepair(async () => {
      const r = await repairWebhookAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("App reinscrito no webhook da Meta");
      await carregar();
    });
  }

  const enderecoCerto = status ? status.callbackUrl === status.esperado : false;
  const temMensagens = status?.campos.includes("messages") ?? false;
  const silencio = status?.ultimoEvento
    ? Date.now() - new Date(status.ultimoEvento).getTime()
    : null;
  const mudoDemais = silencio !== null && silencio > SILENCIO_PREOCUPANTE_MS;
  const saudavel = enderecoCerto && status?.ativo && temMensagens && !mudoDemais;

  return (
    <Card className={saudavel ? undefined : "border-amber-line bg-amber-soft/30"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          {saudavel ? (
            <CheckCircle2 className="size-4 text-ok" />
          ) : (
            <AlertTriangle className="size-4 text-amber" />
          )}
          Webhook da Meta
        </CardTitle>
        <CardDescription>
          É por aqui que chegam as confirmações de entrega e as respostas dos clientes. Quando
          cai, nada chega de ninguém — e a inscrição de cada conta continua dizendo que está
          tudo certo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {carregando && (
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <Loader2 className="size-4 animate-spin" /> Perguntando à Meta…
          </p>
        )}

        {erro && <p className="text-sm text-red">{erro}</p>}

        {status && (
          <dl className="space-y-1.5 text-sm">
            <Linha
              rotulo="Endereço configurado"
              valor={status.callbackUrl ?? "nenhum"}
              ok={enderecoCerto}
            />
            {!enderecoCerto && (
              <Linha rotulo="Deveria ser" valor={status.esperado} ok={null} />
            )}
            <Linha rotulo="Ativo" valor={status.ativo ? "sim" : "não"} ok={status.ativo} />
            <Linha
              rotulo="Eventos assinados"
              valor={status.campos.join(", ") || "nenhum"}
              ok={temMensagens}
            />
            <Linha
              rotulo="Último evento recebido"
              valor={
                status.ultimoEvento
                  ? formatDateTimeBR(status.ultimoEvento)
                  : "nunca"
              }
              ok={!mudoDemais}
            />
          </dl>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className="size-4" /> Verificar de novo
          </Button>
          <Button size="sm" onClick={reparar} disabled={reparando}>
            {reparando && <Loader2 className="size-4 animate-spin" />} Reinscrever o app
          </Button>
        </div>

        <p className="text-xs text-ink-3">
          A Meta só aceita a reinscrição depois de chamar o nosso endereço e receber a resposta
          certa. Se ela aceitar, o caminho de volta está de pé.
        </p>
      </CardContent>
    </Card>
  );
}

function Linha({
  rotulo,
  valor,
  ok,
}: {
  rotulo: string;
  valor: string;
  ok: boolean | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/60 pb-1.5 last:border-0">
      <dt className="text-ink-2">{rotulo}</dt>
      <dd
        className={
          ok === null ? "text-ink-2" : ok ? "font-medium text-ok-ink" : "font-medium text-amber"
        }
      >
        <span className="break-all">{valor}</span>
      </dd>
    </div>
  );
}
