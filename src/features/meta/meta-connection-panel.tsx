import Image from "next/image";
import { AlertTriangle, Gauge, Link2, Plus, ShieldCheck, Sparkles } from "lucide-react";

import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DisconnectMetaButton } from "@/features/meta/disconnect-meta-button";
import { EmbeddedSignupButton } from "@/features/meta/embedded-signup-button";
import { ManualMetaConnectForm } from "@/features/meta/manual-connect-form";
import { RegisterPhoneNumberButton } from "@/features/meta/register-phone-number-button";
import { SyncMetaButton } from "@/features/meta/sync-meta-button";
import type { MetaConnectionView } from "@/server/meta";
import type { ConversationCostSummary, WabaHealthStatus } from "@/lib/meta/graph-api";

const CONNECTION_METHOD_LABEL: Record<string, string> = {
  coexistence: "Coexistência (WhatsApp Business app + Cloud API)",
  embedded_signup: "Embedded Signup",
  manual: "Manual (System User)",
};

// Limites Meta — desde out/2025 são por Business Portfolio (compartilhado
// entre todos os números do mesmo portfolio).
// Docs: https://developers.facebook.com/docs/whatsapp/messaging-limits
const TIER_LABEL: Record<string, string> = {
  TIER_50: "50 / 24h",
  TIER_250: "250 / 24h",
  TIER_1K: "1.000 / 24h",
  TIER_2K: "2.000 / 24h",
  TIER_10K: "10.000 / 24h",
  TIER_100K: "100.000 / 24h",
  TIER_UNLIMITED: "Ilimitado",
};

function tierLabel(tier: string | null): string {
  if (!tier) return "—";
  return TIER_LABEL[tier] ?? tier;
}

function qualityTone(rating: string | null): StatusTone {
  switch (rating) {
    case "GREEN":
      return "ok";
    case "YELLOW":
      return "pending";
    case "RED":
      return "danger";
    default:
      return "neutral";
  }
}

function verificationTone(status: string | null): StatusTone {
  switch (status) {
    case "VERIFIED":
      return "ok";
    case "EXPIRED":
      return "pending";
    case "NOT_VERIFIED":
      return "danger";
    default:
      return "neutral";
  }
}

const VERIFICATION_LABEL: Record<string, string> = {
  VERIFIED: "Verificado",
  EXPIRED: "Expirada",
  NOT_VERIFIED: "Não verificado",
};

function MetaLogo({ size = 18 }: { size?: number }) {
  return <Image src="/meta-logo.png" alt="Meta" width={size} height={size} className="shrink-0" />;
}

/** Ícone do WhatsApp — verde, porque representa o produto WhatsApp. */
function WhatsAppMark({ className }: { className?: string }) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-md border border-ok-line bg-ok-soft ${className ?? ""}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--ok)" aria-hidden>
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.13h-.01c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23z" />
      </svg>
    </span>
  );
}

function WabaHealthBanner({ health }: { health: WabaHealthStatus | null }) {
  if (!health) return null;

  // Só aparece quando tem algo fora do normal — não polui quando está tudo
  // "AVAILABLE" e sem erros.
  const problemEntities = (health.entities ?? []).filter(
    (e) => (e.can_send_message && e.can_send_message !== "AVAILABLE") || (e.errors?.length ?? 0) > 0,
  );
  if (health.can_send_message === "AVAILABLE" && problemEntities.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border border-red-line bg-red-soft p-3 text-xs">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-red" />
        <span className="font-semibold text-ink">Envio limitado pela Meta</span>
        <StatusBadge tone="danger">{health.can_send_message ?? "—"}</StatusBadge>
      </div>
      {problemEntities.map((entity, i) => (
        <div key={i} className="space-y-1 pl-6">
          {(entity.errors ?? []).map((err, j) => (
            <div key={j}>
              <p className="text-ink">{err.error_description ?? "Erro sem descrição"}</p>
              {err.possible_solution && <p className="text-ink-2">{err.possible_solution}</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatusCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 px-3 py-2.5">
      <p className="label-caps">{label}</p>
      <div>{children}</div>
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
  const health = conn.health_status as WabaHealthStatus | null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-brand-line bg-brand-soft">
              <MetaLogo size={18} />
            </span>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-[15px]">
                  {conn.business_name ?? "Business sem nome"}
                </CardTitle>
                <StatusBadge tone="ok">Conectada</StatusBadge>
              </div>
              <p className="font-mono text-[11px] text-ink-3">
                WABA {conn.waba_id} ·{" "}
                {CONNECTION_METHOD_LABEL[conn.connection_method] ?? conn.connection_method}
              </p>
              <p className="text-[11px] text-ink-3">
                Conectado em {connectedAt}
                {lastSyncedAt && ` · Última sincronização ${lastSyncedAt}`}
              </p>
            </div>
          </div>
          {canManage && (
            <CardAction>
              <SyncMetaButton workspaceId={workspaceId} connectionId={conn.id} />
              <DisconnectMetaButton workspaceId={workspaceId} connectionId={conn.id} />
            </CardAction>
          )}
        </CardHeader>
        {(cost || health) && (
          <CardContent className="space-y-3">
            {cost && (
              <div className="flex flex-wrap gap-6 rounded-md border border-line bg-card-2 px-3 py-2.5">
                <div>
                  <p className="label-caps">Gasto (mês atual)</p>
                  <p className="num mt-0.5 text-lg leading-none">
                    {cost.currency ?? "$"} {cost.totalCost.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="label-caps">Conversas</p>
                  <p className="num mt-0.5 text-lg leading-none">
                    {cost.totalConversations.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            )}
            <WabaHealthBanner health={health} />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Número de envio</CardTitle>
            <CardDescription>
              Cada disparo seleciona um desses números como remetente.
            </CardDescription>
          </div>
          <CardAction>
            <span className="rounded-full border border-line-2 bg-card-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
              {phoneNumbers.length} número{phoneNumbers.length === 1 ? "" : "s"}
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {phoneNumbers.length === 0 ? (
            <p className="text-sm text-ink-3">
              Nenhum número configurado neste WABA. Adicione no painel Meta e sincronize.
            </p>
          ) : (
            phoneNumbers.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-md border border-line">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <WhatsAppMark />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-ink">
                        {p.display_phone_number}
                      </p>
                      <p className="truncate font-mono text-[11px] text-ink-3">
                        {p.verified_name ?? "Sem nome verificado"} · {p.phone_number_id}
                      </p>
                    </div>
                  </div>
                  {!p.is_registered && (
                    /* Qualquer membro pode registrar — não é gerenciar a
                       conexão, só corrige um estado inconsistente do número. */
                    <RegisterPhoneNumberButton workspaceId={workspaceId} phoneNumberRowId={p.id} />
                  )}
                </div>

                <div className="grid grid-cols-2 divide-x divide-line border-t border-line bg-card-2 sm:grid-cols-4">
                  <StatusCell label="Qualidade">
                    <StatusBadge tone={qualityTone(p.quality_rating)}>
                      {p.quality_rating ?? "—"}
                    </StatusBadge>
                  </StatusCell>
                  <StatusCell label="Registro">
                    {p.is_registered ? (
                      <StatusBadge tone="ok">Registrado</StatusBadge>
                    ) : (
                      <StatusBadge tone="danger">Não registrado</StatusBadge>
                    )}
                  </StatusCell>
                  <StatusCell label="Verificação">
                    {p.code_verification_status ? (
                      <StatusBadge tone={verificationTone(p.code_verification_status)}>
                        {VERIFICATION_LABEL[p.code_verification_status] ??
                          p.code_verification_status}
                      </StatusBadge>
                    ) : (
                      <span className="text-xs text-ink-4">—</span>
                    )}
                  </StatusCell>
                  <StatusCell label="Limite portfólio">
                    <p
                      className="flex items-center gap-1.5 text-[13px] font-semibold text-ink"
                      title="Limite Meta de conversas business-initiated em 24h, compartilhado entre todos os números do portfolio."
                    >
                      <Gauge className="size-3.5 text-ink-3" />
                      {tierLabel(p.messaging_limit_tier)}
                    </p>
                  </StatusCell>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChoiceCard({
  icon: Icon,
  title,
  badge,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-brand-line bg-brand-soft text-brand">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink">{title}</p>
              {badge && (
                <span className="rounded-full border border-line-2 bg-card-2 px-2 py-0.5 text-[10px] font-semibold text-ink-2">
                  {badge}
                </span>
              )}
            </div>
            <p className="max-w-prose text-xs text-ink-2">{description}</p>
          </div>
        </div>
        <div className="shrink-0">{children}</div>
      </div>
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

  const connectOptions = canManage ? (
    <div className="space-y-3">
      {standardSignupEnabled && (
        <ChoiceCard
          icon={Sparkles}
          title="Criar do zero"
          badge="Embedded Signup"
          description="Pro cliente que ainda não tem número no WhatsApp Business — a Meta cria a WABA e o número no fluxo integrado."
        >
          <EmbeddedSignupButton
            appId={metaAppId!}
            configId={standardSignupConfigId!}
            graphApiVersion={graphApiVersion}
            workspaceId={workspaceId}
            connectionMethod="embedded_signup"
            ctaLabel="Criar número"
          />
        </ChoiceCard>
      )}

      {coexistenceEnabled && (
        <ChoiceCard
          icon={Link2}
          title="Login com Coexistência"
          description="Pro cliente que já usa o app WhatsApp Business no celular e quer manter os dois: app + Cloud API."
        >
          <EmbeddedSignupButton
            appId={metaAppId!}
            configId={coexistenceConfigId!}
            graphApiVersion={graphApiVersion}
            workspaceId={workspaceId}
            featureType="whatsapp_business_app_onboarding"
            connectionMethod="coexistence"
            ctaLabel="Conectar app"
          />
        </ChoiceCard>
      )}

      <div className="rounded-md border border-line p-3">
        <div className="flex gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-brand-line bg-brand-soft text-brand">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">Conexão manual</p>
              <p className="max-w-prose text-xs text-ink-2">
                WABA já dentro da Autoprocs — token gerado via System User, sem expiração.
              </p>
            </div>
            <ManualMetaConnectForm workspaceId={workspaceId} />
          </div>
        </div>
      </div>
    </div>
  ) : (
    <p className="text-sm text-ink-3">
      Apenas owners podem conectar a conta Meta deste workspace.
    </p>
  );

  if (connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Conectar WhatsApp Business</CardTitle>
            <CardDescription>
              Escolha como esse workspace vai falar com a Meta.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>{connectOptions}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-4 text-ink-3" /> Conectar outra conta
              </CardTitle>
              <CardDescription>
                Adiciona uma nova WABA a este workspace — não mexe nas contas já conectadas.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>{connectOptions}</CardContent>
        </Card>
      )}
    </div>
  );
}
