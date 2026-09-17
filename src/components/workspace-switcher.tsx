"use client";

import * as React from "react";
import { useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
        <button
          type="button"
          disabled={isPending}
          className="flex h-10 w-full items-center gap-2 rounded-md border border-nav-line bg-nav-active px-2 text-left transition-colors hover:border-ink-2/40 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-nav text-[10px] font-semibold text-nav-ink">
            {initials(active.name)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-nav-active-ink">
            {active.name}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-nav-ink-2" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[212px]">
        <DropdownMenuLabel className="label-caps">Workspaces</DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem key={ws.id} onClick={() => handleSelect(ws.id)} className="gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-card-2 text-[10px] font-semibold text-ink-2">
              {initials(ws.name)}
            </span>
            <span className="min-w-0 flex-1 truncate">{ws.name}</span>
            <Check className={cn("size-4", active.id === ws.id ? "opacity-100" : "opacity-0")} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
