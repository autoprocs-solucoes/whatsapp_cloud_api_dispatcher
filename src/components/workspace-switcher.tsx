"use client";

import * as React from "react";
import Image from "next/image";
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
  logoUrl?: string | null;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function WorkspaceMark({
  name,
  logoUrl,
  size = 32,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-md bg-white object-contain"
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md bg-nav-active text-[11px] font-semibold text-nav-ink"
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}

type Props = {
  active: WorkspaceOption;
  workspaces: WorkspaceOption[];
};

/** Identidade do cliente no topo do menu — logo + nome. Também é o seletor
 * quando a conta pertence a mais de um workspace. */
export function WorkspaceSwitcher({ active, workspaces }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSelect(id: string) {
    if (id === active.id) return;
    startTransition(async () => {
      await switchWorkspaceAction(id);
    });
  }

  const brand = (
    <>
      <WorkspaceMark name={active.name} logoUrl={active.logoUrl} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-nav-active-ink">
        {active.name}
      </span>
    </>
  );

  if (workspaces.length <= 1) {
    return <div className="flex items-center gap-2.5 px-1 py-1">{brand}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          className="flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-nav-active focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-60"
        >
          {brand}
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
