import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-border-subtle placeholder:text-text-muted focus-visible:border-border aria-invalid:border-danger-text flex field-sizing-content min-h-16 w-full rounded-md border bg-bg px-3 py-2 text-[12px] transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
