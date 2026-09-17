"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, UserCircle, Users2 } from "lucide-react";

import { navGroupLabelClass, navItemClass } from "@/components/app-sidebar";
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

const NAV_ITEMS = [
  { title: "Clientes", href: "/master", icon: Users2 },
  { title: "Perfil", href: "/master/perfil", icon: UserCircle },
] as const;

export function MasterSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 border-b border-nav-line p-3">
        <div className="flex items-center gap-2.5">
          <Image
            src="/autoprocs-logo.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-md bg-white object-contain p-0.5"
          />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-nav-active-ink group-data-[collapsible=icon]:hidden">
            Dispatcher
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-4 px-2 py-3">
        <SidebarGroup className="gap-1 p-0">
          <SidebarGroupLabel className={navGroupLabelClass}>Master</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/master"
                    ? pathname === "/master" || pathname.startsWith("/master/cliente")
                    : pathname.startsWith(item.href);
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
      </SidebarContent>

      <SidebarFooter className="border-t border-nav-line p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Voltar ao workspace" className={navItemClass}>
              <Link href={"/dashboard" as Route}>
                <ArrowLeft />
                <span>Voltar ao workspace</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
