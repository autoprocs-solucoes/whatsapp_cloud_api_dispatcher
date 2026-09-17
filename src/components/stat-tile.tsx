import Link from "next/link";
import type { Route } from "next";

import { AnimatedNumber } from "@/components/animated-number";
import { cn } from "@/lib/utils";

type Props = {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
  suffix?: string;
  caption?: React.ReactNode;
  tone?: "default" | "muted" | "destructive";
  href?: string;
  delayMs?: number;
  className?: string;
};

/** Tile de indicador com contagem animada. Só ganha hover de elevação quando
 * é clicável (`href`) — hover em elemento estático sugere interação que não
 * existe. */
export function StatTile({
  icon: Icon,
  label,
  value,
  suffix,
  caption,
  tone = "default",
  href,
  delayMs = 0,
  className,
}: Props) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="text-muted-foreground size-4" />}
        <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold",
          tone === "destructive" ? "text-destructive" : "text-foreground",
        )}
      >
        {value === null ? "—" : <AnimatedNumber value={value} suffix={suffix} />}
      </p>
      {caption && <div className="text-muted-foreground mt-1 text-[11px]">{caption}</div>}
    </>
  );

  const classes = cn(
    "animate-in fade-in slide-in-from-bottom-1 block rounded-md border p-4 duration-500",
    tone === "muted" && "bg-muted/40",
    tone === "destructive" && "border-destructive/30 bg-destructive/5",
    tone === "default" && "bg-card",
    href &&
      "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md",
    className,
  );
  const style = { animationDelay: `${delayMs}ms`, animationFillMode: "backwards" as const };

  if (href) {
    return (
      <Link href={href as Route} className={classes} style={style}>
        {body}
      </Link>
    );
  }
  return (
    <div className={classes} style={style}>
      {body}
    </div>
  );
}
