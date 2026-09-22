"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "@/features/notifications/actions";
import { vapidPublicKey } from "@/lib/push/vapid";

type State = "checking" | "unsupported" | "denied" | "off" | "on";

/**
 * A chave pública VAPID chega em base64url e o navegador quer bytes.
 *
 * Devolve ArrayBuffer em vez de Uint8Array porque o tipo de `Uint8Array` pode
 * apontar pra SharedArrayBuffer, que `applicationServerKey` não aceita.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

/**
 * Liga/desliga as notificações NESTE navegador: mensagem nova nas conversas e
 * transmissão concluída.
 *
 * É por aparelho, não por conta: o endpoint é emitido pelo navegador, então
 * quem usa desktop e celular precisa ligar nos dois.
 */
export function PushToggle() {
  // A chave vem do módulo, com a env tendo precedência: valor colado no painel
  // costuma chegar com caractere invisível e derrubar o atob.
  const key = vapidPublicKey();
  const [state, setState] = useState<State>("checking");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!key) {
      setState("unsupported");
      return;
    }
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("unsupported"));
  }, [key]);

  async function enable() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(key),
      });

      const json = sub.toJSON();
      startTransition(async () => {
        const res = await subscribeToPushAction({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setState("on");
        toast.success("Notificações ativadas neste navegador");
      });
    } catch (e) {
      toast.error(`Não foi possível ativar: ${(e as Error).message}`);
    }
  }

  async function disable() {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) {
        setState("off");
        return;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      startTransition(async () => {
        await unsubscribeFromPushAction(endpoint);
        setState("off");
        toast.success("Notificações desativadas neste navegador");
      });
    } catch (e) {
      toast.error(`Não foi possível desativar: ${(e as Error).message}`);
    }
  }

  if (state === "checking") {
    return <p className="text-xs text-ink-3">Verificando suporte do navegador...</p>;
  }

  if (state === "unsupported") {
    return (
      <p className="text-xs text-ink-2">
        Este navegador não suporta notificações, ou elas ainda não foram configuradas no servidor.
        No iPhone, adicione o Dispatcher à Tela de Início pelo Safari para que o recurso apareça.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-xs text-red">
        As notificações foram bloqueadas para este site. Libere nas configurações do navegador
        (ícone de cadeado na barra de endereço) e recarregue a página.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === "on" ? (
        <Button variant="outline" size="sm" onClick={disable} disabled={isPending}>
          <BellOff className="size-4" /> Desativar neste navegador
        </Button>
      ) : (
        <Button size="sm" onClick={enable} disabled={isPending}>
          <Bell className="size-4" /> Ativar neste navegador
        </Button>
      )}
      <span className="text-xs text-ink-3">
        {state === "on" ? "Ativadas aqui" : "Desativadas aqui"}
      </span>
    </div>
  );
}
