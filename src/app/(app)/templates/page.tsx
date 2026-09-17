import Link from "next/link";
import { MessageSquare, Plug } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getTemplateAnalyticsForWorkspace,
  listTemplatesForWorkspace,
} from "@/features/templates/actions";
import { TemplatesTable } from "@/features/templates/templates-table";
import { getMetaConnections } from "@/server/meta";
import { requireActiveWorkspace } from "@/server/workspace";

export default async function TemplatesPage() {
  const workspace = await requireActiveWorkspace();
  const connections = await getMetaConnections(workspace.id);
  const templates = await listTemplatesForWorkspace();
  const analyticsByTemplateId = await getTemplateAnalyticsForWorkspace(templates, connections);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Templates"
        description="Sincronizados da Meta. A criação é no WhatsApp Manager; aqui espelhamos status e conteúdo."
      />

      {connections.length === 0 ? (
        <Card className="border-dashed border-line-2">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Plug className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">Sem conexão Meta</h2>
              <p className="max-w-sm text-sm text-ink-2">
                Conecte a WABA do workspace antes de sincronizar templates.
              </p>
            </div>
            <Button asChild className="mt-2">
              <Link href="/configuracoes">
                <MessageSquare className="mr-1 size-4" /> Ir para Configurações
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TemplatesTable
          templates={templates}
          isOwner={workspace.role === "owner"}
          analyticsByTemplateId={analyticsByTemplateId}
        />
      )}
    </div>
  );
}
