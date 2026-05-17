"use client";

import * as React from "react";
import { useTransition } from "react";
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
import { switchWorkspaceAction } from "@/features/workspace/actions";
import { cn } from "@/lib/utils";

export type WorkspaceOption = {
  id: string;
  name: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

type Props = {
  active: WorkspaceOption;
  workspaces: WorkspaceOption[];
};

export function WorkspaceSwitcher({ active, workspaces }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSelect(id: string) {
    if (id === active.id) return;
    startTransition(async () => {
      await switchWorkspaceAction(id);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full justify-between gap-2 px-2"
          disabled={isPending}
        >
          <Avatar className="size-6">
            <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-medium">
              {initials(active.name)}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[160px] flex-1 truncate text-left text-sm font-medium">
            {active.name}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel className="text-muted-foreground text-xs">Workspaces</DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem key={ws.id} onClick={() => handleSelect(ws.id)} className="gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-medium">
                {initials(ws.name)}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate">{ws.name}</span>
            <Check className={cn("size-4", active.id === ws.id ? "opacity-100" : "opacity-0")} />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2">
          <Plus className="size-4" />
          Novo workspace (em breve)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
