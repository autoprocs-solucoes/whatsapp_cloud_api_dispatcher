import Link from "next/link";
import { MessageSquare, Plug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listTemplatesForWorkspace } from "@/features/templates/actions";
import { TemplatesTable } from "@/features/templates/templates-table";
import { getMetaConnection } from "@/server/meta";
import { requireActiveWorkspace } from "@/server/workspace";

export default async function TemplatesPage() {
  const workspace = await requireActiveWorkspace();
  const conn = await getMetaConnection(workspace.id);
  const templates = await listTemplatesForWorkspace();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="text-muted-foreground text-sm">
          Templates sincronizados da Meta. Criação direto no WhatsApp Manager — aqui só
          espelhamos status e conteúdo.
        </p>
      </header>

      {!conn ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl">
              <Plug className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-foreground text-lg font-semibold">Sem conexão Meta</h2>
              <p className="text-muted-foreground max-w-sm text-sm">
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
        <TemplatesTable templates={templates} canSync={workspace.role === "owner"} />
      )}
    </div>
  );
}
