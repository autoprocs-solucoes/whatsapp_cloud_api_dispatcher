import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Pílula de rótulo: fundo claro da cor + borda clara. Para *status* (Ativo,
 * Concluído, Falhou...) use `StatusBadge`, que acrescenta o pontinho — este
 * aqui é o rótulo cru (tags, idioma, categoria).
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        // sucesso (Ativo / Concluído / Aprovado / Conectada / GREEN)
        default: "border-ok-line bg-ok-soft text-ok-ink",
        info: "border-brand-line bg-brand-soft text-brand-strong",
        secondary: "border-line-2 bg-card-2 text-ink-2",
        destructive: "border-red-line bg-red-soft text-red",
        pending: "border-amber-line bg-amber-soft text-amber",
        owner: "border-violet-line bg-violet-soft text-violet",
        outline: "border-line-2 bg-card text-ink-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
