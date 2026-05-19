"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  hint?: string;
};

export type ComboboxGroup = {
  label?: string;
  options: ComboboxOption[];
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  groups?: ComboboxGroup[];
  options?: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: "default" | "sm";
};

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function Combobox({
  value,
  onChange,
  groups,
  options,
  placeholder = "Selecione…",
  searchPlaceholder = "Buscar…",
  emptyMessage = "Nenhuma opção encontrada",
  disabled,
  className,
  triggerClassName,
  size = "default",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const resolvedGroups: ComboboxGroup[] = useMemo(() => {
    if (groups && groups.length > 0) return groups;
    if (options && options.length > 0) return [{ options }];
    return [];
  }, [groups, options]);

  const allOptions = useMemo(
    () => resolvedGroups.flatMap((g) => g.options),
    [resolvedGroups],
  );

  const selected = allOptions.find((o) => o.value === value);

  const filteredGroups = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return resolvedGroups;
    return resolvedGroups
      .map((g) => ({
        ...g,
        options: g.options.filter(
          (o) => normalize(o.label).includes(q) || normalize(o.value).includes(q),
        ),
      }))
      .filter((g) => g.options.length > 0);
  }, [resolvedGroups, query]);

  const flatFiltered = useMemo(
    () => filteredGroups.flatMap((g) => g.options),
    [filteredGroups],
  );

  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function handleSelect(v: string) {
    onChange(v);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = flatFiltered[activeIdx];
      if (opt) handleSelect(opt.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  const triggerHeight = size === "sm" ? "h-8" : "h-9";

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "border-input bg-transparent hover:bg-accent/40 inline-flex items-center justify-between gap-2 rounded-md border px-3 text-sm shadow-xs transition-colors",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            triggerHeight,
            triggerClassName,
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            "bg-popover text-popover-foreground z-50 min-w-[14rem] overflow-hidden rounded-md border shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <div className="border-b px-2 py-1.5">
            <div className="flex items-center gap-2">
              <Search className="text-muted-foreground size-4 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="placeholder:text-muted-foreground w-full bg-transparent py-1.5 text-sm outline-none"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredGroups.length === 0 ? (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                {emptyMessage}
              </p>
            ) : (
              filteredGroups.map((group, gi) => {
                const offsetBefore = filteredGroups
                  .slice(0, gi)
                  .reduce((acc, g) => acc + g.options.length, 0);
                return (
                  <div key={`${group.label ?? "g"}-${gi}`} className="py-0.5">
                    {group.label && (
                      <p className="text-muted-foreground px-2 py-1 text-[10px] font-medium uppercase tracking-wider">
                        {group.label}
                      </p>
                    )}
                    {group.options.map((opt, oi) => {
                      const idx = offsetBefore + oi;
                      const isActive = idx === activeIdx;
                      const isSelected = opt.value === value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => handleSelect(opt.value)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm",
                            isActive && "bg-accent text-accent-foreground",
                          )}
                        >
                          <span className="flex flex-col">
                            <span className="truncate">{opt.label}</span>
                            {opt.hint && (
                              <span className="text-muted-foreground text-[10px]">
                                {opt.hint}
                              </span>
                            )}
                          </span>
                          {isSelected && <Check className="size-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
