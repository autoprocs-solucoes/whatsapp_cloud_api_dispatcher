import { AcceptInviteForm } from "@/features/auth/accept-invite-form";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Aceitar convite — Autoprocs Dispatcher" };

export default async function AcceptInvitePage() {
  const user = await requireUser();

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
      <AcceptInviteForm email={user.email} defaultFullName={user.profile.full_name} />
    </div>
  );
}
