import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/** Cabeçalho de página: H1 23px, subtítulo cinza, ações à direita. */
export function PageHeader({ title, description, actions, className }: Props) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="space-y-1">
        <h1 className="text-[23px] leading-tight font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {description && <p className="text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
