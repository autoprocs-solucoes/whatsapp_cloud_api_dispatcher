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
    <SidebarProvider style={{ "--sidebar-width": "236px" } as React.CSSProperties}>
      <AppSidebar
        activeWorkspace={{ id: activeWorkspace.id, name: activeWorkspace.name }}
        workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
        isMaster={user.profile.is_superadmin}
        user={{ name: user.profile.full_name, email: user.email }}
      />
      <SidebarInset className="min-w-0 bg-paper">
        <AppHeader
          user={{
            fullName: user.profile.full_name,
            email: user.email,
            avatarUrl: user.profile.avatar_url,
          }}
        />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
