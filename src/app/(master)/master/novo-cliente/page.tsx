import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateWorkspaceForm } from "@/features/workspace/create-workspace-form";

export const metadata = { title: "Novo cliente | Autoprocs Dispatcher" };

/**
 * Cadastro de cliente pelo painel master.
 *
 * Existe separado do /onboarding porque aquele é a tela de primeiro acesso:
 * quem já tem workspace é redirecionado pro dashboard. Pro master, que sempre
 * tem workspace, o link antigo caía dentro do cliente ativo em vez de abrir um
 * formulário. O acesso é garantido pelo layout do grupo (master).
 */
export default function NovoClientePage() {
  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/master">
          <ChevronLeft className="size-4" /> Voltar
        </Link>
      </Button>

      <PageHeader
        title="Novo cliente"
        description="Cria um workspace vazio. Você entra como owner e pode convidar a equipe do cliente depois."
      />

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Dados do cliente</CardTitle>
          <CardDescription>
            Só o nome por enquanto. Logo, membros e conexão com a Meta são configurados dentro do
            workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkspaceForm mode="master" />
        </CardContent>
      </Card>
    </div>
  );
}
