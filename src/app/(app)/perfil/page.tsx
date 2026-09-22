import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PushToggle } from "@/features/notifications/push-toggle";
import { AvatarUploadForm } from "@/features/profile/avatar-upload-form";
import { ProfileNameForm } from "@/features/profile/profile-name-form";
import { requireUser } from "@/server/auth";

/** Conta do usuário — vale pra qualquer pessoa do workspace, independente do
 * papel. Configurações (workspace, membros, Meta) é outra coisa, e só owner
 * enxerga. */
export default async function PerfilPage() {
  const user = await requireUser();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Perfil"
        description="Seus dados de acesso e como você aparece pra quem divide o workspace com você."
      />

      <Card>
        <CardHeader>
          <CardTitle>Seus dados</CardTitle>
          <CardDescription>Foto e nome de exibição.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <p className="label-caps">E-mail</p>
            <p className="font-mono text-sm text-ink">{user.email}</p>
            <p className="text-xs text-ink-3">
              É o e-mail de acesso; pra trocar, fale com quem administra o workspace.
            </p>
          </div>

          <AvatarUploadForm
            initialAvatarUrl={user.profile.avatar_url}
            fullName={user.profile.full_name}
            email={user.email}
          />

          <ProfileNameForm initialName={user.profile.full_name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
          <CardDescription>
            Avisa quando chega mensagem nas conversas e quando uma transmissão termina. Vale só para os workspaces em que
            você é owner, e precisa ser ligado em cada navegador que você usa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushToggle />
        </CardContent>
      </Card>
    </div>
  );
}
