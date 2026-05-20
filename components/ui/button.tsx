import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-display tracking-wide uppercase transition-none active:translate-x-[2px] active:translate-y-[2px] disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-0 focus-visible:outline-[2px] focus-visible:outline-signal focus-visible:outline-offset-0 rounded-none shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-background text-foreground border-2 border-foreground hover:bg-foreground hover:text-background",
        signal: "bg-transparent text-signal border-2 border-signal hover:bg-signal hover:text-void",
        ghost: "bg-transparent border-2 border-transparent text-foreground",
        danger: "bg-denied text-paper border-2 border-denied hover:bg-transparent hover:text-denied",
      },
      size: {
        default: "h-10 px-6 py-2 text-lg [&_svg]:size-5 gap-2",
        sm: "h-8 px-4 py-1.5 text-base [&_svg]:size-4 gap-1.5",
        md: "h-10 px-6 py-2 text-lg [&_svg]:size-5 gap-2",
        lg: "h-12 px-8 py-3 text-xl [&_svg]:size-6 gap-3",
        icon: "size-10 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant || "primary"}
      data-size={size || "md"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

