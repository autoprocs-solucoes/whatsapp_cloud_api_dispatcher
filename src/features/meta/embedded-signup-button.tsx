"use client";

import * as React from "react";
import { useTransition } from "react";
import Script from "next/script";
import { Facebook, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  completeMetaSignupAction,
  logMetaSignupEventAction,
} from "@/features/meta/actions";

// Tipos mínimos do FB JS SDK
type FBInitOptions = {
  appId: string;
  cookie: boolean;
  xfbml: boolean;
  version: string;
};

type FBLoginResponse = {
  status: "connected" | "not_authorized" | "unknown";
  authResponse?: {
    code?: string;
    accessToken?: string;
    userID?: string;
  };
};

type FBLoginOptions = {
  config_id: string;
  response_type: "code";
  override_default_response_type: boolean;
  extras?: {
    setup?: Record<string, unknown>;
    featureType?: string;
    sessionInfoVersion?: string;
    version?: string;
    features?: { name: string }[];
  };
};

type FBSdk = {
  init: (opts: FBInitOptions) => void;
  login: (callback: (response: FBLoginResponse) => void, options?: FBLoginOptions) => void;
};

declare global {
  interface Window {
    FB?: FBSdk;
    fbAsyncInit?: () => void;
  }
}

/** Versão do diálogo do Embedded Signup. Ver comentário no FB.init abaixo. */
const SIGNUP_DIALOG_VERSION = "v25.0";

type SessionInfo = {
  event: string;
  data: {
    waba_id?: string;
    phone_number_id?: string;
    business_id?: string;
  };
};

/** Payload do evento CANCEL — traz o motivo quando a Meta interrompe o fluxo. */
type CancelInfo = {
  current_step?: string;
  error_message?: string;
  error_code?: string | number;
};

type Props = {
  appId: string;
  configId: string;
  workspaceId: string;
  ctaLabel?: string;
  /** "whatsapp_business_app_onboarding" ativa o fluxo de Coexistência. */
  featureType?: string;
  connectionMethod?: "embedded_signup" | "coexistence";
};

export function EmbeddedSignupButton({
  appId,
  configId,
  workspaceId,
  ctaLabel = "Conectar Facebook",
  featureType = "",
  connectionMethod = "embedded_signup",
}: Props) {
  const [sdkReady, setSdkReady] = React.useState(false);
  const [isPending, startTransition] = useTransition();
  const sessionInfoRef = React.useRef<SessionInfo["data"] | null>(null);
  const cancelInfoRef = React.useRef<CancelInfo | null>(null);

  // Listener pra capturar `session_info_response` antes do callback do login.
  React.useEffect(() => {
    function isFacebookOrigin(origin: string): boolean {
      try {
        const host = new URL(origin).hostname;
        // Compara por host, não por sufixo de string: "evilfacebook.com"
        // passaria num endsWith("facebook.com").
        return host === "facebook.com" || host.endsWith(".facebook.com");
      } catch {
        return false;
      }
    }

    function handleMessage(event: MessageEvent) {
      if (!isFacebookOrigin(event.origin)) return;
      try {
        const parsed = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (parsed?.type !== "WA_EMBEDDED_SIGNUP") return;

        // A Meta tem um evento de término por tipo de fluxo — FINISH,
        // FINISH_ONLY_WABA, FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING,
        // FINISH_OBO_MIGRATION, FINISH_GRANT_ONLY_API_ACCESS. Só "FINISH" era
        // aceito aqui, então a Coexistência concluía na Meta e o resultado era
        // descartado: o cliente terminava o fluxo e o workspace continuava
        // "Sem conexão", sem nada explicando.
        if (typeof parsed.event === "string" && parsed.event.startsWith("FINISH")) {
          sessionInfoRef.current = parsed.data ?? null;
          void logMetaSignupEventAction({
            workspaceId,
            stage: "finish",
            wabaId: parsed.data?.waba_id ?? null,
            phoneNumberId: parsed.data?.phone_number_id ?? null,
            detail: { event: parsed.event },
          });
          return;
        }

        // CANCEL carrega o motivo real quando o fluxo falha do lado da Meta.
        if (parsed.event === "CANCEL") {
          cancelInfoRef.current = parsed.data ?? null;
          void logMetaSignupEventAction({
            workspaceId,
            stage: "cancel",
            error: parsed.data?.error_message ?? null,
            detail: parsed.data ?? null,
          });
        }
      } catch {
        // Ignora mensagens não-JSON.
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [workspaceId]);

  // Inicializa FB SDK quando o script carregar.
  //
  // A versão aqui é do diálogo do Embedded Signup e NÃO acompanha a
  // META_GRAPH_API_VERSION usada nas chamadas de servidor (envio, templates,
  // analytics), que continua onde está porque mudá-la mexeria no que já
  // funciona. Elas são independentes: o SDK só abre o popup.
  //
  // Fica fixa numa versão recente porque a Coexistência é nova — a
  // documentação dela usa v25.0 nos exemplos, e versões antigas do diálogo
  // ignoram o `featureType` em silêncio, caindo no cadastro padrão (que pede
  // pra digitar um número em vez de parear com o app do celular).
  React.useEffect(() => {
    if (!sdkReady || !window.FB) return;
    window.FB.init({
      appId,
      cookie: true,
      xfbml: true,
      version: SIGNUP_DIALOG_VERSION,
    });
  }, [sdkReady, appId]);

  function launchSignup() {
    if (!window.FB) {
      toast.error("SDK do Facebook ainda carregando. Tente novamente em 1s.");
      return;
    }

    void logMetaSignupEventAction({ workspaceId, stage: "launch", method: connectionMethod });

    window.FB.login(
      (response: FBLoginResponse) => {
        const code = response.authResponse?.code;
        const session = sessionInfoRef.current;

        const cancel = cancelInfoRef.current;
        // A Meta explica o que deu errado no evento CANCEL; sem isso o usuário
        // só via "não foi possível" e não tinha o que investigar.
        const metaReason = cancel?.error_message
          ? `${cancel.error_message}${cancel.error_code ? ` (${cancel.error_code})` : ""}`
          : cancel?.current_step
            ? `Interrompido na etapa ${cancel.current_step}.`
            : null;

        if (!code) {
          void logMetaSignupEventAction({
            workspaceId,
            stage: "failed",
            method: connectionMethod,
            error: metaReason ?? `sem code (status ${response.status ?? "?"})`,
            detail: { hasSession: Boolean(session?.waba_id) },
          });
          if (metaReason) {
            toast.error(metaReason);
          } else if (response.status === "not_authorized") {
            toast.error("Você cancelou o Embedded Signup.");
          } else {
            toast.error("Não foi possível concluir o login. Tente de novo.");
          }
          cancelInfoRef.current = null;
          return;
        }
        // Ter o `code` basta. Antes, faltar o aviso do popup abortava tudo
        // aqui — e o cliente terminava o cadastro na Meta, com número
        // registrado e cartão cadastrado, sem conexão nenhuma deste lado. O
        // servidor descobre o WABA pelo token quando o popup não contou.
        if (!session?.waba_id) {
          void logMetaSignupEventAction({
            workspaceId,
            stage: "finish",
            method: connectionMethod,
            error: "popup não informou o WABA — resolvendo pelo token",
          });
        }

        startTransition(async () => {
          const result = await completeMetaSignupAction({
            workspaceId,
            code,
            wabaId: session?.waba_id,
            phoneNumberIds: session?.phone_number_id ? [session.phone_number_id] : undefined,
            connectionMethod,
          });

          void logMetaSignupEventAction({
            workspaceId,
            stage: result.ok ? "saved" : "failed",
            method: connectionMethod,
            wabaId: session?.waba_id ?? null,
            phoneNumberId: session?.phone_number_id ?? null,
            error: result.ok ? null : result.error,
          });

          if (result.ok) {
            toast.success("Conta WhatsApp Business conectada");
          } else {
            toast.error(result.error);
          }
          sessionInfoRef.current = null;
          cancelInfoRef.current = null;
        });
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        // Forma documentada pela Meta pro Cadastro Incorporado. Pra
        // Coexistência muda só o `featureType`.
        //
        // Aqui havia um `features: [{name: "marketing_messages_lite"}, ...]`
        // adicionado como contorno de um erro de business_id. Ele trocava o
        // fluxo inteiro: em vez do pareamento com o app do celular, a Meta
        // abria o cadastro do Marketing Messages Lite, que pede pra digitar um
        // número de envio — e oferecia o número de teste americano,
        // reinterpretado como brasileiro. Nunca dava pra conectar um número
        // que já existe no app.
        extras: {
          setup: {},
          featureType,
          sessionInfoVersion: "3",
        },
      },
    );
  }

  return (
    <>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />
      <Button onClick={launchSignup} disabled={!sdkReady || isPending} size="lg">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Facebook className="size-4" />
        )}
        {isPending ? "Conectando..." : ctaLabel}
      </Button>
    </>
  );
}
