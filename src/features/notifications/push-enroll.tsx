"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { subscribeToPushAction } from "@/features/notifications/actions";
import { vapidPublicKey } from "@/lib/push/vapid";

/**
 * Adesão ao push sem depender de alguém lembrar de ir no Perfil.
 *
 * Quem já deu permissão é reinscrito em silêncio — a inscrição morre sozinha
 * quando o navegador limpa dados, e sem isso a pessoa acha que está ligado e
 * não recebe nada. Quem ainda não decidiu vê uma faixa de um clique, e "agora
 * não" cala por uma semana.
 */

const SNOOZE_KEY = "push-enroll-snooze";
const SESSION_KEY = "push-enroll-done";
const SNOOZE_DAYS = 7;

function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

/** iOS só entrega push se o site estiver na tela de início. */
function isIosWithoutHomeScreen(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  if (!isIos) return false;
  return !("standalone" in navigator && (navigator as { standalone?: boolean }).standalone);
}

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushAutoEnroll() {
  const [showBanner, setShowBanner] = useState(false);
  const [working, setWorking] = useState(false);

  const enroll = useCallback(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    const sub =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(vapidPublicKey()),
      }));

    const json = sub.toJSON();
    const result = await subscribeToPushAction({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      userAgent: navigator.userAgent.slice(0, 200),
    });

    // Servidor recusou: desfaz no navegador pra não ficar "ligado" de mentira.
    if (!result.ok) await sub.unsubscribe();
    return result.ok;
  }, []);

  useEffect(() => {
    if (!supported() || isIosWithoutHomeScreen()) return;
    // Uma vez por aba: reinscrever a cada navegação seria ruído puro.
    if (sessionStorage.getItem(SESSION_KEY)) return;

    if (Notification.permission === "granted") {
      sessionStorage.setItem(SESSION_KEY, "1");
      void enroll().catch(() => {
        /* aparelho sem push agora; a faixa aparece numa próxima sessão */
      });
      return;
    }

    if (Notification.permission === "denied") return;

    const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (Date.now() < snoozedUntil) return;

    setShowBanner(true);
  }, [enroll]);

  if (!showBanner) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-line bg-brand-soft px-4 py-3">
      <Bell className="size-4 shrink-0 text-brand" />
      <p className="min-w-0 flex-1 text-sm text-ink">
        Quer receber aviso quando chegar mensagem nas conversas?
      </p>
      <Button
        size="sm"
        disabled={working}
        onClick={async () => {
          setWorking(true);
          try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
              setShowBanner(false);
              return;
            }
            sessionStorage.setItem(SESSION_KEY, "1");
            await enroll();
            setShowBanner(false);
          } finally {
            setWorking(false);
          }
        }}
      >
        Ativar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Agora não"
        onClick={() => {
          localStorage.setItem(
            SNOOZE_KEY,
            String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000),
          );
          setShowBanner(false);
        }}
      >
        <X className="size-4" /> Agora não
      </Button>
    </div>
  );
}
