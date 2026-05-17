"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Workspace = { id: string; name: string };

// Mock — substituir por dados reais em E1.
const MOCK_WORKSPACES: Workspace[] = [
  { id: "ws_autoprocs", name: "Autoprocs (interno)" },
  { id: "ws_cliente_a", name: "Cliente A — Demo" },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

export function WorkspaceSwitcher() {
  const [active, setActive] = React.useState<Workspace>(MOCK_WORKSPACES[0]!);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 justify-between gap-2 px-2">
          <Avatar className="size-6">
            <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-medium">
              {initials(active.name)}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[160px] truncate text-sm font-medium">{active.name}</span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel className="text-muted-foreground text-xs">Workspaces</DropdownMenuLabel>
        {MOCK_WORKSPACES.map((ws) => (
          <DropdownMenuItem key={ws.id} onClick={() => setActive(ws)} className="gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-medium">
                {initials(ws.name)}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate">{ws.name}</span>
            <Check
              className={cn("size-4", active.id === ws.id ? "opacity-100" : "opacity-0")}
            />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2">
          <Plus className="size-4" />
          Novo workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
