"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";
import { signOutAction } from "@/features/auth/actions";
import { resolveBreadcrumb } from "@/lib/navigation";

type Props = {
  user: { fullName: string; email: string; avatarUrl: string | null };
};

export function AppHeader({ user }: Props) {
  const pathname = usePathname();
  const crumb = resolveBreadcrumb(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper px-4">
      {/* No desktop a sidebar é fixa; o gatilho só existe pro modo compacto. */}
      <SidebarTrigger className="-ml-1 text-ink-2" />

      {crumb && (
        <nav aria-label="Trilha de navegação" className="flex items-center gap-1.5 text-[13px]">
          <span className="text-ink-3">{crumb.section}</span>
          <ChevronRight className="size-3.5 text-ink-4" />
          <span className="font-semibold text-ink">{crumb.page}</span>
        </nav>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void signOutAction();
          }}
        >
          <LogOut className="size-3.5" />
          Sair
        </Button>
        <UserMenu fullName={user.fullName} email={user.email} avatarUrl={user.avatarUrl} />
      </div>
    </header>
  );
}
