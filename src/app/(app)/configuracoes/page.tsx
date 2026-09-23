import Image from "next/image";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetaConnectionPanel } from "@/features/meta/meta-connection-panel";
import { RecoverWabaPanel } from "@/features/meta/recover-waba-panel";
import { WorkspaceLogoForm } from "@/features/workspace/workspace-logo-form";
import { InviteMemberForm } from "@/features/workspace/invite-member-form";
import { MembersTable } from "@/features/workspace/members-table";
import { removeMemberAction } from "@/features/workspace/actions";
import { WorkspaceSettingsForm } from "@/features/workspace/workspace-settings-form";
import { serverEnv } from "@/lib/env";
import { requireUser } from "@/server/auth";
import { getConnectionsCost, getLastFailedSignup, getMetaConnections } from "@/server/meta";
import { findUnlinkedWabas } from "@/server/meta-recovery";
import { getWorkspaceMembers } from "@/server/members";
import { requireActiveWorkspace } from "@/server/workspace";

/**
 * Configurações do workspace: logo da empresa, membros e conexão Meta. É área
 * de administração — quem não é owner (nem master) não entra. Os dados
 * pessoais de cada usuário ficam em /perfil.
 */
export default async function ConfiguracoesPage() {
  const user = await requireUser();
  const workspace = await requireActiveWorkspace();
  const canManage = workspace.role === "owner" || user.profile.is_superadmin;
  if (!canManage) notFound();

  const [members, metaConnections] = await Promise.all([
    getWorkspaceMembers(workspace.id),
    getMetaConnections(workspace.id),
  ]);
  const costByConnectionId = await getConnectionsCost(metaConnections);
  const lastFailedSignup = await getLastFailedSignup(workspace.id);
  // Só o time master vê: a busca atravessa clientes, e é o master quem liga
  // uma conta órfã ao dono certo. Só em cliente sem conexão nenhuma, que é o
  // caso em que ela serve — são várias chamadas à Meta e elas seguram a
  // página. Falha aqui não pode derrubar a tela.
  const unlinkedWabas =
    user.profile.is_superadmin && metaConnections.length === 0
      ? await findUnlinkedWabas().catch(() => [])
      : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configurações"
        description="Dados da empresa, membros e conexão com a Meta."
      />

      <Tabs defaultValue="workspace" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="meta" className="gap-1.5">
            <Image src="/meta-logo.png" alt="" width={14} height={14} /> Meta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <Card>
            <CardHeader>
              <CardTitle>Dados da empresa</CardTitle>
              <CardDescription>
                Logo e nome exibidos no topo do menu para todos os membros.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <WorkspaceLogoForm
                workspaceId={workspace.id}
                workspaceName={workspace.name}
                initialLogoUrl={workspace.logo_url}
                canEdit={canManage}
              />
              <WorkspaceSettingsForm
                workspaceId={workspace.id}
                initialName={workspace.name}
                canEdit={canManage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Convidar membro</CardTitle>
              <CardDescription>
                O convidado recebe e-mail com link para definir senha e entrar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InviteMemberForm workspaceId={workspace.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Membros</CardTitle>
              <CardDescription>
                {members.length} no total · clique na foto pra ver ampliada
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <MembersTable
                members={members}
                workspaceId={workspace.id}
                currentUserId={user.id}
                canManage={canManage}
                onRemove={removeMemberAction as unknown as (fd: FormData) => Promise<void>}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta" className="space-y-4">
          <RecoverWabaPanel
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            wabas={unlinkedWabas}
          />
          <MetaConnectionPanel
            workspaceId={workspace.id}
            canManage={canManage}
            connections={metaConnections}
            costByConnectionId={costByConnectionId}
            metaAppId={serverEnv.META_APP_ID}
            coexistenceConfigId={serverEnv.META_COEXISTENCE_CONFIG_ID}
            standardSignupConfigId={serverEnv.META_EMBEDDED_SIGNUP_CONFIG_ID}
            lastFailedSignup={lastFailedSignup}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
