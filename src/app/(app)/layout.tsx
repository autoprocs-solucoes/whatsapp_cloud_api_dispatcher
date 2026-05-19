import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireUser } from "@/server/auth";
import { getUserWorkspaces, requireActiveWorkspace } from "@/server/workspace";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const activeWorkspace = await requireActiveWorkspace();
  const workspaces = await getUserWorkspaces();

  return (
    <SidebarProvider>
      <AppSidebar
        activeWorkspace={{ id: activeWorkspace.id, name: activeWorkspace.name }}
        workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
      />
      <SidebarInset className="min-w-0">
        <AppHeader user={{ fullName: user.profile.full_name, email: user.email }} />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
