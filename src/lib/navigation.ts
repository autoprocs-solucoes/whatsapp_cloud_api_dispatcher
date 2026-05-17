import { LayoutDashboard, MessageSquare, Send, Settings, Tag, Users } from "lucide-react";
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
      { title: "Contatos", href: "/contatos", icon: Users },
      { title: "Segmentos", href: "/segmentos", icon: Tag },
      { title: "Templates", href: "/templates", icon: MessageSquare },
      { title: "Comunicados", href: "/comunicados", icon: Send },
    ],
  },
  {
    label: "Workspace",
    items: [{ title: "Configurações", href: "/configuracoes", icon: Settings }],
  },
];
