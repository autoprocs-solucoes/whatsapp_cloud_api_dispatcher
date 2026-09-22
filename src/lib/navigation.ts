import {
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Send,
  Settings,
  Tag,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Geral",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Comunicação",
    items: [
      { title: "Conversas", href: "/conversas", icon: Inbox },
      { title: "Contatos", href: "/contatos", icon: Users },
      { title: "Segmentos", href: "/segmentos", icon: Tag },
      { title: "Templates", href: "/templates", icon: MessageSquare },
      { title: "Fluxos", href: "/fluxos", icon: Workflow },
      { title: "Comunicados", href: "/comunicados", icon: Send },
    ],
  },
  {
    label: "Workspace",
    items: [{ title: "Configurações", href: "/configuracoes", icon: Settings }],
  },
];

export type Breadcrumb = { section: string; page: string };

/** "Seção › Página" da topbar. Rotas do Master não vivem em `navGroups`
 * (grupo de rotas separado), então entram como caso explícito. */
export function resolveBreadcrumb(pathname: string): Breadcrumb | null {
  if (pathname.startsWith("/perfil")) return { section: "Conta", page: "Perfil" };
  if (pathname.startsWith("/master/perfil")) return { section: "Master", page: "Perfil" };
  if (pathname.startsWith("/master/novo-cliente")) {
    return { section: "Master", page: "Novo cliente" };
  }
  if (pathname === "/master" || pathname.startsWith("/master/")) {
    return { section: "Master", page: "Clientes" };
  }

  for (const group of navGroups) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return { section: group.label, page: item.title };
      }
    }
  }
  return null;
}
