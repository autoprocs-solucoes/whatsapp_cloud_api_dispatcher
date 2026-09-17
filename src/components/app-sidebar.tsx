"use client";

import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher, type WorkspaceOption } from "@/components/workspace-switcher";
import { navGroups } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Classes do item de nav: ativo ganha fundo, texto branco, ícone azul e a
 * barrinha de 3px à esquerda. */
export const navItemClass = cn(
  "relative h-9 rounded-md px-2 text-[13px] font-medium text-nav-ink",
  "hover:bg-nav-active hover:text-nav-active-ink",
  "[&>svg]:text-nav-ink-2 hover:[&>svg]:text-nav-ink",
  "data-[active=true]:font-semibold data-[active=true]:[&>svg]:text-brand-2",
  "data-[active=true]:before:absolute data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:left-0 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-brand",
);

export const navGroupLabelClass = "label-caps px-2 text-nav-ink-2";

type Props = {
  activeWorkspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
  user: { name: string; email: string; avatarUrl: string | null };
};

/**
 * Menu do workspace. É a visão do cliente — nada de plataforma/master aqui,
 * mesmo pra quem é superadmin: quem entra num cliente vê exatamente o que o
 * cliente vê.
 */
export function AppSidebar({ activeWorkspace, workspaces, user }: Props) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-nav-line p-3">
        <div className="group-data-[collapsible=icon]:hidden">
          <WorkspaceSwitcher active={activeWorkspace} workspaces={workspaces} />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-4 px-2 py-3">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="gap-1 p-0">
            <SidebarGroupLabel className={navGroupLabelClass}>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={navItemClass}
                      >
                        <Link href={item.href as Route}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-nav-line p-3">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:hidden">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              width={28}
              height={28}
              className="size-7 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-nav-active text-[11px] font-semibold text-nav-active-ink">
              {(user.name || user.email).slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-xs font-medium text-nav-ink">
              {user.name || "Sem nome"}
            </span>
            <span className="truncate text-[11px] text-nav-ink-2">{user.email}</span>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
