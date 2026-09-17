import { AppHeader } from "@/components/app-header";
import { MasterSidebar } from "@/components/master-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireMasterUser } from "@/server/master";

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMasterUser();

  return (
    <SidebarProvider>
      <MasterSidebar />
      <SidebarInset className="min-w-0">
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
