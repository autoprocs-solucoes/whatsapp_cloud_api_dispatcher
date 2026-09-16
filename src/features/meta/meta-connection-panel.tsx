import Image from "next/image";
import { AlertTriangle, CheckCircle2, Gauge, Phone, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DisconnectMetaButton } from "@/features/meta/disconnect-meta-button";
import { EmbeddedSignupButton } from "@/features/meta/embedded-signup-button";
import { ManualMetaConnectForm } from "@/features/meta/manual-connect-form";
import { RegisterPhoneNumberButton } from "@/features/meta/register-phone-number-button";
import { SyncMetaButton } from "@/features/meta/sync-meta-button";
import type { MetaConnectionView } from "@/server/meta";
import type { ConversationCostSummary, WabaHealthStatus } from "@/lib/meta/graph-api";

const CAN_SEND_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível",
  LIMITED: "Limitado",
  BLOCKED: "Bloqueado",
};

function canSendBadgeVariant(status: string | undefined): "default" | "secondary" | "destructive" {
  switch (status) {
    case "AVAILABLE":
      return "default";
    case "LIMITED":
      return "secondary";
    case "BLOCKED":
      return "destructive";
    default:
      return "secondary";
  }
}

function WabaHealthBanner({ health }: { health: WabaHealthStatus | null }) {
  if (!health) return null;

  // Só mostra alerta quando tem algo fora do normal — não polui a tela
  // quando está tudo "AVAILABLE" e sem erros.
  const problemEntities = (health.entities ?? []).filter(
    (e) => (e.can_send_message && e.can_send_message !== "AVAILABLE") || (e.errors?.length ?? 0) > 0,
  );
  if (health.can_send_message === "AVAILABLE" && problemEntities.length === 0) return null;

  return (
    <div className="border-destructive/30 bg-destructive/5 space-y-2 rounded-md border p-3 text-xs">
      <div className="flex items-center gap-2">
        <ShieldAlert className="text-destructive size-4" />
        <span className="font-medium">
          Envio {(CAN_SEND_LABEL[health.can_send_message ?? ""] ?? health.can_send_message ?? "desconhecido").toLowerCase()}{" "}
          pela Meta
        </span>
        <Badge variant={canSendBadgeVariant(health.can_send_message)} className="text-[10px]">
          {CAN_SEND_LABEL[health.can_send_message ?? ""] ?? health.can_send_message ?? "—"}
        </Badge>
      </div>
      {problemEntities.map((entity, i) => (
        <div key={i} className="space-y-1 pl-6">
          {(entity.errors ?? []).map((err, j) => (
            <div key={j} className="flex items-start gap-1.5">
              <AlertTriangle className="text-destructive mt-0.5 size-3 shrink-0" />
              <div>
                <p className="text-foreground">{err.error_description ?? "Erro sem descrição"}</p>
                {err.possible_solution && (
                  <p className="text-muted-foreground">{err.possible_solution}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

type Props = {
  workspaceId: string;
  canManage: boolean;
  connections: MetaConnectionView[];
  costByConnectionId: Map<string, ConversationCostSummary | null>;
  metaAppId: string | undefined;
  graphApiVersion: string;
  coexistenceConfigId: string | undefined;
  standardSignupConfigId: string | undefined;
};

const CONNECTION_METHOD_LABEL: Record<string, string> = {
  coexistence: "Coexistência (WhatsApp Business app + Cloud API)",
  embedded_signup: "Embedded Signup",
  manual: "Manual (System User)",
};

function qualityBadgeVariant(rating: string | null): "default" | "secondary" | "destructive" {
  switch (rating) {
    case "GREEN":
      return "default";
    case "YELLOW":
      return "secondary";
    case "RED":
      return "destructive";
    default:
      return "secondary";
  }
}

// Limites Meta — desde out/2025 são por Business Portfolio (compartilhado
// entre todos os números do mesmo portfolio).
// Docs: https://developers.facebook.com/docs/whatsapp/messaging-limits
const TIER_LABEL: Record<string, string> = {
  TIER_50: "50 conversas / 24h",
  TIER_250: "250 conversas / 24h",
  TIER_1K: "1.000 conversas / 24h",
  TIER_2K: "2.000 conversas / 24h",
  TIER_10K: "10.000 conversas / 24h",
  TIER_100K: "100.000 conversas / 24h",
  TIER_UNLIMITED: "Ilimitado",
};

function tierLabel(tier: string | null): string {
  if (!tier) return "Limite não informado pela Meta";
  return TIER_LABEL[tier] ?? tier;
}

function MetaLogo({ size = 18 }: { size?: number }) {
  return (
    <Image
      src="/meta-logo.png"
      alt="Meta"
      width={size}
      height={size}
      className="shrink-0"
    />
  );
}

function ConnectAccountButton({
  workspaceId,
  metaAppId,
  graphApiVersion,
  coexistenceConfigId,
  ctaLabel,
}: {
  workspaceId: string;
  metaAppId: string;
  graphApiVersion: string;
  coexistenceConfigId: string;
  ctaLabel?: string;
}) {
  return (
    <EmbeddedSignupButton
      appId={metaAppId}
      configId={coexistenceConfigId}
      graphApiVersion={graphApiVersion}
      workspaceId={workspaceId}
      featureType="whatsapp_business_app_onboarding"
      connectionMethod="coexistence"
      ctaLabel={ctaLabel}
    />
  );
}

// Fluxo padrão do Embedded Signup: cria uma WABA + número novos do zero
// (sem exigir que o cliente já tenha o WhatsApp Business app configurado).
// Usa a config_id própria do signup padrão — diferente da de Coexistência,
// que exige uma configuração específica liberada pra esse fluxo no painel Meta.
function StandardSignupButton({
  workspaceId,
  metaAppId,
  graphApiVersion,
  standardSignupConfigId,
  ctaLabel,
}: {
  workspaceId: string;
  metaAppId: string;
  graphApiVersion: string;
  standardSignupConfigId: string;
  ctaLabel?: string;
}) {
  return (
    <EmbeddedSignupButton
      appId={metaAppId}
      configId={standardSignupConfigId}
      graphApiVersion={graphApiVersion}
      workspaceId={workspaceId}
      connectionMethod="embedded_signup"
      ctaLabel={ctaLabel}
    />
  );
}

function ConnectionCostStat({ cost }: { cost: ConversationCostSummary | null | undefined }) {
  if (!cost) return null;
  return (
    <div className="bg-muted/40 flex items-center gap-4 rounded-md border px-3 py-2 text-xs">
      <div>
        <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
          Gasto (mês atual)
        </p>
        <p className="text-foreground text-sm font-semibold">
          {cost.currency ?? "$"} {cost.totalCost.toFixed(2)}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Conversas</p>
        <p className="text-foreground text-sm font-semibold">{cost.totalConversations}</p>
      </div>
    </div>
  );
}

function ConnectionCard({
  workspaceId,
  canManage,
  view,
  cost,
}: {
  workspaceId: string;
  canManage: boolean;
  view: MetaConnectionView;
  cost: ConversationCostSummary | null | undefined;
}) {
  const { connection: conn, phoneNumbers } = view;
  const connectedAt = new Date(conn.connected_at).toLocaleString("pt-BR");
  const lastSyncedAt =
    phoneNumbers.length > 0
      ? new Date(
          Math.max(...phoneNumbers.map((p) => new Date(p.last_synced_at).getTime())),
        ).toLocaleString("pt-BR")
      : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MetaLogo size={20} />
              <CardTitle>{conn.business_name ?? "Business sem nome"}</CardTitle>
              <CheckCircle2 className="text-primary size-4" />
            </div>
            <CardDescription>
              WABA <code className="text-[11px]">{conn.waba_id}</code>
            </CardDescription>
            <Badge variant="outline" className="w-fit">
              {CONNECTION_METHOD_LABEL[conn.connection_method] ?? conn.connection_method}
            </Badge>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <SyncMetaButton workspaceId={workspaceId} connectionId={conn.id} />
              <DisconnectMetaButton workspaceId={workspaceId} connectionId={conn.id} />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-muted-foreground space-y-0.5 text-xs">
            <p>Conectado em {connectedAt}.</p>
            {lastSyncedAt && <p>Última sincronização em {lastSyncedAt}.</p>}
          </div>
          <ConnectionCostStat cost={cost} />
          <WabaHealthBanner health={conn.health_status as WabaHealthStatus | null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="size-4" /> Phone numbers ({phoneNumbers.length})
          </CardTitle>
          <CardDescription>
            Cada disparo seleciona um destes números como remetente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {phoneNumbers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum número configurado neste WABA. Adicione no painel Meta e sincronize.
            </p>
          ) : (
            phoneNumbers.map((p, idx) => (
              <div key={p.id}>
                {idx > 0 && <Separator className="my-3" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">{p.display_phone_number}</p>
                    <p className="text-muted-foreground text-xs">
                      {p.verified_name ?? "Sem nome verificado"} ·{" "}
                      <code className="text-[10px]">{p.phone_number_id}</code>
                    </p>
                    <p
                      className="text-muted-foreground flex items-center gap-1 text-xs"
                      title="Limite Meta de conversas business-initiated em 24h. Desde out/2025 é por Business Portfolio (compartilhado entre todos os números). Sobe conforme verificação + qualidade."
                    >
                      <Gauge className="size-3" />
                      Limite portfólio: <strong>{tierLabel(p.messaging_limit_tier)}</strong>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={qualityBadgeVariant(p.quality_rating)}>
                      Quality: {p.quality_rating ?? "—"}
                    </Badge>
                    {p.code_verification_status && (
                      <Badge variant="secondary">{p.code_verification_status}</Badge>
                    )}
                    {p.is_registered ? (
                      <Badge variant="default">Registrado (Cloud API)</Badge>
                    ) : (
                      <>
                        <Badge variant="destructive">Não registrado</Badge>
                        {/* Qualquer membro do workspace pode registrar — não é
                            uma ação de gerenciar a conexão (canManage/owner),
                            só corrige um estado inconsistente do número. */}
                        <RegisterPhoneNumberButton
                          workspaceId={workspaceId}
                          phoneNumberRowId={p.id}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MetaConnectionPanel({
  workspaceId,
  canManage,
  connections,
  costByConnectionId,
  metaAppId,
  graphApiVersion,
  coexistenceConfigId,
  standardSignupConfigId,
}: Props) {
  const coexistenceEnabled = Boolean(metaAppId && coexistenceConfigId);
  const standardSignupEnabled = Boolean(metaAppId && standardSignupConfigId);

  const connectOptions = canManage && (
    <>
      {standardSignupEnabled && (
        <div className="space-y-2 rounded-md border p-4">
          <p className="text-sm font-medium">Criar do zero (Embedded Signup padrão)</p>
          <p className="text-muted-foreground text-xs">
            Pro cliente que ainda não tem número de WhatsApp Business — a Meta cria a WABA e o
            número novos no fluxo de login integrado.
          </p>
          <StandardSignupButton
            workspaceId={workspaceId}
            metaAppId={metaAppId!}
            graphApiVersion={graphApiVersion}
            standardSignupConfigId={standardSignupConfigId!}
            ctaLabel="Criar novo número"
          />
        </div>
      )}
      {coexistenceEnabled && (
        <div
          className={
            standardSignupEnabled ? "space-y-2 border-t pt-4" : "space-y-2 rounded-md border p-4"
          }
        >
          <p className="text-sm font-medium">Login integrado com Coexistência</p>
          <p className="text-muted-foreground text-xs">
            Pro cliente que já usa o app WhatsApp Business no celular e quer manter os dois
            funcionando juntos (app + Cloud API).
          </p>
          <ConnectAccountButton
            workspaceId={workspaceId}
            metaAppId={metaAppId!}
            graphApiVersion={graphApiVersion}
            coexistenceConfigId={coexistenceConfigId!}
            ctaLabel="Conectar com WhatsApp Business app"
          />
        </div>
      )}
      <div
        className={
          standardSignupEnabled || coexistenceEnabled ? "space-y-2 border-t pt-4" : "space-y-2"
        }
      >
        <p className="text-sm font-medium">Conexão manual (WABA já existe na Autoprocs)</p>
        <ManualMetaConnectForm workspaceId={workspaceId} />
      </div>
    </>
  );

  if (connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MetaLogo size={20} /> Conectar WhatsApp Business
          </CardTitle>
          <CardDescription>
            Use &quot;Criar do zero&quot; se o cliente ainda não tem número. Use login integrado
            com Coexistência se ele vai manter o app WhatsApp Business ativo no celular enquanto a
            Cloud API passa a disparar em conjunto. Use a conexão manual se a WABA já existe dentro
            do Business Manager da própria Autoprocs — a Meta não deixa escolher o negócio dono do
            app no login integrado, então esse caso só dá pra conectar colando WABA ID + token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage ? (
            connectOptions
          ) : (
            <p className="text-muted-foreground text-sm">
              Apenas owners podem conectar a conta Meta deste workspace.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {connections.map((view) => (
        <ConnectionCard
          key={view.connection.id}
          workspaceId={workspaceId}
          canManage={canManage}
          view={view}
          cost={costByConnectionId.get(view.connection.id)}
        />
      ))}

      {canManage && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Conectar outra conta</CardTitle>
            <CardDescription>
              Adiciona uma nova WABA a esse workspace (não mexe nas contas já conectadas acima).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">{connectOptions}</CardContent>
        </Card>
      )}
    </div>
  );
}
