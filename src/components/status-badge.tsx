import { cn } from "@/lib/utils";

export type StatusTone = "ok" | "info" | "danger" | "pending" | "neutral" | "owner";

const TONE: Record<StatusTone, { pill: string; dot: string }> = {
  ok: { pill: "border-ok-line bg-ok-soft text-ok-ink", dot: "bg-ok" },
  info: { pill: "border-brand-line bg-brand-soft text-brand-strong", dot: "bg-brand" },
  danger: { pill: "border-red-line bg-red-soft text-red", dot: "bg-red" },
  pending: { pill: "border-amber-line bg-amber-soft text-amber", dot: "bg-amber" },
  neutral: { pill: "border-line-2 bg-card-2 text-ink-2", dot: "bg-ink-4" },
  owner: { pill: "border-violet-line bg-violet-soft text-violet", dot: "bg-violet" },
};

type Props = {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
};

/** Selo de estado: pontinho da cor + texto, em pílula clara. A cor nunca é a
 * única pista — o texto sempre acompanha. */
export function StatusBadge({ tone = "neutral", children, className }: Props) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        t.pill,
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} aria-hidden />
      {children}
    </span>
  );
}
