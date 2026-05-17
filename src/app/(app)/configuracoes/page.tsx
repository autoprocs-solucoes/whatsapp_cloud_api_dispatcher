import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InviteMemberForm } from "@/features/workspace/invite-member-form";
import { MembersTable } from "@/features/workspace/members-table";
import { removeMemberAction } from "@/features/workspace/actions";
import { WorkspaceSettingsForm } from "@/features/workspace/workspace-settings-form";
import { requireUser } from "@/server/auth";
import { getWorkspaceMembers } from "@/server/members";
import { requireActiveWorkspace } from "@/server/workspace";

export default async function ConfiguracoesPage() {
  const user = await requireUser();
  const workspace = await requireActiveWorkspace();
  const isOwner = workspace.role === "owner";
  const members = await getWorkspaceMembers(workspace.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Edite o workspace, gerencie membros e (em breve) conecte sua conta Meta.
        </p>
      </header>

      <Tabs defaultValue="workspace" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="meta" disabled>
            Meta (E2)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <Card>
            <CardHeader>
              <CardTitle>Dados do workspace</CardTitle>
              <CardDescription>Nome exibido para todos os membros.</CardDescription>
            </CardHeader>
            <CardContent>
              <WorkspaceSettingsForm
                workspaceId={workspace.id}
                initialName={workspace.name}
                canEdit={isOwner}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          {isOwner && (
            <Card>
              <CardHeader>
                <CardTitle>Convidar membro</CardTitle>
                <CardDescription>
                  O convidado recebe email com link para definir senha e entrar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InviteMemberForm workspaceId={workspace.id} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Membros</CardTitle>
              <CardDescription>{members.length} no total</CardDescription>
            </CardHeader>
            <CardContent>
              <MembersTable
                members={members}
                workspaceId={workspace.id}
                currentUserId={user.id}
                canManage={isOwner}
                onRemove={removeMemberAction as unknown as (fd: FormData) => Promise<void>}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
