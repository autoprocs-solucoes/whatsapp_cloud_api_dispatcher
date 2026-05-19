import { CheckCircle2, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DisconnectMetaButton } from "@/features/meta/disconnect-meta-button";
import { ManualMetaConnectForm } from "@/features/meta/manual-connect-form";
import { SyncMetaButton } from "@/features/meta/sync-meta-button";
import type { MetaConnectionView } from "@/server/meta";

type Props = {
  workspaceId: string;
  canManage: boolean;
  connection: MetaConnectionView | null;
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

export function MetaConnectionPanel({ workspaceId, canManage, connection }: Props) {
  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conectar WhatsApp Business</CardTitle>
          <CardDescription>
            Para disparar mensagens, conecte a WhatsApp Business Account (WABA) do cliente. O
            cliente compartilha credenciais via System User no Business Manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage ? (
            <>
              <ManualMetaConnectForm workspaceId={workspaceId} />
              <div className="text-muted-foreground border-t pt-4 text-xs">
                Não sabe onde achar WABA ID + Access Token? Consulte o guia em{" "}
                <code className="text-[10px]">docs/meta-setup-manual.md</code> e passe ao cliente
                pra coletar via System User no Business Manager.
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Apenas owners podem conectar a conta Meta deste workspace.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const { connection: conn, phoneNumbers } = connection;
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
              <CheckCircle2 className="text-primary size-5" />
              <CardTitle>Conta Meta conectada</CardTitle>
            </div>
            <CardDescription>
              {conn.business_name ?? "Business sem nome"} · WABA{" "}
              <code className="text-[11px]">{conn.waba_id}</code>
            </CardDescription>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <SyncMetaButton workspaceId={workspaceId} />
              <DisconnectMetaButton workspaceId={workspaceId} />
            </div>
          )}
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-0.5 text-xs">
          <p>Conectado em {connectedAt}.</p>
          {lastSyncedAt && <p>Última sincronização em {lastSyncedAt}.</p>}
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
              Nenhum número configurado neste WABA. Adicione no painel Meta e reconecte.
            </p>
          ) : (
            phoneNumbers.map((p, idx) => (
              <div key={p.id}>
                {idx > 0 && <Separator className="my-3" />}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="font-medium">{p.display_phone_number}</p>
                    <p className="text-muted-foreground text-xs">
                      {p.verified_name ?? "Sem nome verificado"} ·{" "}
                      <code className="text-[10px]">{p.phone_number_id}</code>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={qualityBadgeVariant(p.quality_rating)}>
                      Quality: {p.quality_rating ?? "—"}
                    </Badge>
                    {p.code_verification_status && (
                      <Badge variant="secondary">{p.code_verification_status}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Reconectar com novo token</CardTitle>
            <CardDescription>
              Use se o cliente gerou novo Access Token ou trocou de WABA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ManualMetaConnectForm workspaceId={workspaceId} ctaLabel="Reconectar" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
