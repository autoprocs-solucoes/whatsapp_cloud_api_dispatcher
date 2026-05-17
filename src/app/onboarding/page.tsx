import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateWorkspaceForm } from "@/features/workspace/create-workspace-form";
import { requireUser } from "@/server/auth";
import { getUserWorkspaces } from "@/server/workspace";

export const metadata = { title: "Criar workspace — Autoprocs Dispatcher" };

export default async function OnboardingPage() {
  await requireUser();

  const workspaces = await getUserWorkspaces();
  if (workspaces.length > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crie seu primeiro workspace</CardTitle>
          <CardDescription>
            Workspaces isolam dados de cada cliente/empresa. Você pode criar quantos quiser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkspaceForm />
        </CardContent>
      </Card>
    </div>
  );
}
