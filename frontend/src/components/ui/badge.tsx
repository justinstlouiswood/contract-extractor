import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[4px] border border-transparent px-[7px] py-[2px] text-[10px] font-semibold tracking-[0.01em] w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[2px] transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-fg",
        secondary:
          "bg-bg-muted text-text-muted border-border-subtle",
        destructive:
          "bg-danger-bg text-danger-text border-danger-border",
        outline:
          "border-border-subtle text-text-default",
        ghost: "text-text-muted",
        link: "text-text underline-offset-4 [a&]:hover:underline",
        success:
          "bg-success-bg text-success-text border-success-border",
        approved:
          "bg-success-bg text-success-text border-success-border",
        warning:
          "bg-warning-bg text-warning-text border-warning-border",
        danger:
          "bg-danger-bg text-danger-text border-danger-border",
        info:
          "bg-info-bg text-info-text border-info-border",
        extracted:
          "bg-success-bg text-success-text border-success-border",
        review:
          "bg-warning-bg text-warning-text border-warning-border",
        pending:
          "bg-info-bg text-info-text border-info-border",
        neutral:
          "bg-bg-muted text-text-muted border-border-subtle",
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
