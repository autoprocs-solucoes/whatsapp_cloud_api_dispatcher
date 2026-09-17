"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Send, ShieldCheck } from "lucide-react";

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
  isMaster?: boolean;
  user: { name: string; email: string };
};

export function AppSidebar({ activeWorkspace, workspaces, isMaster, user }: Props) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 border-b border-nav-line p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand">
            <Send className="size-4 text-white" />
          </div>
          <div className="grid flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[13px] font-semibold text-nav-active-ink">
              Autoprocs · Dispatcher
            </span>
            <span className="truncate text-[11px] text-nav-ink-2">Disparos WhatsApp</span>
          </div>
        </div>
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

        {isMaster && (
          <SidebarGroup className="gap-1 p-0">
            <SidebarGroupLabel className={navGroupLabelClass}>Plataforma</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Master" className={navItemClass}>
                    <Link href={"/master" as Route}>
                      <ShieldCheck />
                      <span>Master</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-nav-line p-3">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:hidden">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-nav-active text-[11px] font-semibold text-nav-active-ink">
            {(user.name || user.email).slice(0, 2).toUpperCase()}
          </div>
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
