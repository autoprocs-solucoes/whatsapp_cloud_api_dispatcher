import { AppHeader } from "@/components/app-header";
import { MasterSidebar } from "@/components/master-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireMasterUser } from "@/server/master";

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  await requireMasterUser();

  return (
    <SidebarProvider style={{ "--sidebar-width": "236px" } as React.CSSProperties}>
      <MasterSidebar />
      <SidebarInset className="min-w-0 bg-paper">
        <AppHeader />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
