"use client";

import * as React from "react";
import { useTransition } from "react";
import Script from "next/script";
import { Facebook, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { completeMetaSignupAction } from "@/features/meta/actions";

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
  extras?: { setup?: Record<string, unknown>; featureType?: string };
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

type SessionInfo = {
  event: string;
  data: {
    waba_id?: string;
    phone_number_id?: string;
    business_id?: string;
  };
};

type Props = {
  appId: string;
  configId: string;
  graphApiVersion: string;
  workspaceId: string;
  ctaLabel?: string;
};

export function EmbeddedSignupButton({
  appId,
  configId,
  graphApiVersion,
  workspaceId,
  ctaLabel = "Conectar Facebook",
}: Props) {
  const [sdkReady, setSdkReady] = React.useState(false);
  const [isPending, startTransition] = useTransition();
  const sessionInfoRef = React.useRef<SessionInfo["data"] | null>(null);

  // Listener pra capturar `session_info_response` antes do callback do login.
  React.useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }
      try {
        const parsed = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (parsed?.type === "WA_EMBEDDED_SIGNUP" && parsed?.event === "FINISH") {
          sessionInfoRef.current = parsed.data ?? null;
        }
      } catch {
        // Ignora mensagens não-JSON.
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Inicializa FB SDK quando o script carregar.
  React.useEffect(() => {
    if (!sdkReady || !window.FB) return;
    window.FB.init({
      appId,
      cookie: true,
      xfbml: true,
      version: graphApiVersion,
    });
  }, [sdkReady, appId, graphApiVersion]);

  function launchSignup() {
    if (!window.FB) {
      toast.error("SDK do Facebook ainda carregando. Tente novamente em 1s.");
      return;
    }

    window.FB.login(
      (response: FBLoginResponse) => {
        const code = response.authResponse?.code;
        const session = sessionInfoRef.current;

        if (!code) {
          if (response.status === "not_authorized") {
            toast.error("Você cancelou o Embedded Signup.");
          } else {
            toast.error("Não foi possível concluir o login. Tente de novo.");
          }
          return;
        }
        if (!session?.waba_id) {
          toast.error(
            "Embedded Signup terminou sem informar o WABA. Verifique permissões da configuração no painel Meta.",
          );
          return;
        }

        startTransition(async () => {
          const result = await completeMetaSignupAction({
            workspaceId,
            code,
            wabaId: session.waba_id,
            phoneNumberIds: session.phone_number_id ? [session.phone_number_id] : undefined,
          });

          if (result.ok) {
            toast.success("Conta WhatsApp Business conectada");
          } else {
            toast.error(result.error);
          }
          sessionInfoRef.current = null;
        });
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "" },
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
