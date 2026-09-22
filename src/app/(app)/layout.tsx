import { AppHeader } from "@/components/app-header";
import { PushAutoEnroll } from "@/features/notifications/push-enroll";
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
        activeWorkspace={{
          id: activeWorkspace.id,
          name: activeWorkspace.name,
          logoUrl: activeWorkspace.logo_url,
        }}
        workspaces={workspaces.map((w) => ({ id: w.id, name: w.name, logoUrl: w.logo_url }))}
        user={{
          name: user.profile.full_name,
          email: user.email,
          avatarUrl: user.profile.avatar_url,
        }}
        canManageWorkspace={activeWorkspace.role === "owner" || user.profile.is_superadmin}
        isMaster={user.profile.is_superadmin}
      />
      <SidebarInset className="min-w-0 bg-paper">
        <AppHeader />
        <main className="min-w-0 flex-1 p-6">
          <PushAutoEnroll />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
