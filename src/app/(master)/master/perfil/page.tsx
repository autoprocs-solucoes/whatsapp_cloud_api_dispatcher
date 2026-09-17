import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DemoteMasterMemberButton } from "@/features/master/demote-member-button";
import { PromoteMasterMemberForm } from "@/features/master/promote-member-form";
import { AvatarUploadForm } from "@/features/profile/avatar-upload-form";
import { requireUser } from "@/server/auth";
import { listMasterMembers } from "@/server/master";

export default async function MasterPerfilPage() {
  const user = await requireUser();
  const members = await listMasterMembers();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="text-muted-foreground text-sm">
          Sua foto e quem mais no time Autoprocs tem acesso ao painel Master.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Foto de perfil</CardTitle>
          <CardDescription>Aparece no menu do usuário.</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUploadForm
            initialAvatarUrl={user.profile.avatar_url}
            fullName={user.profile.full_name}
            email={user.email}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adicionar acesso master</CardTitle>
          <CardDescription>
            Dá visão de todos os clientes pra outra pessoa do time Autoprocs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromoteMasterMemberForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time master ({members.length})</CardTitle>
          <CardDescription>Quem tem acesso a /master hoje.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{m.fullName || "Sem nome"}</p>
                <p className="text-muted-foreground text-xs">{m.email ?? m.userId}</p>
              </div>
              {m.userId !== user.id && (
                <DemoteMasterMemberButton userId={m.userId} name={m.fullName || m.email || ""} />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
