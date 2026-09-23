"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[0.5rem] text-sm font-semibold transition-[background,color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kuartz-lime/30 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-kuartz-lime bg-kuartz-lime text-kuartz-ink hover:bg-kuartz-limeDeep",
        ink: "border border-kuartz-ink bg-kuartz-ink text-white hover:bg-kuartz-navy",
        outline: "border border-kuartz-control bg-white text-kuartz-ink hover:border-kuartz-ink hover:bg-kuartz-lineSoft/60",
        ghost: "border border-transparent bg-transparent text-kuartz-secondary hover:bg-kuartz-lineSoft/70 hover:text-kuartz-ink",
        danger: "border border-[#e2b5b2] bg-[#fff4f3] text-[#7e403d] hover:border-[#c98580] hover:bg-[#fbe5e3]",
      },
      size: {
        sm: "min-h-9 px-3 text-[0.8125rem]",
        md: "min-h-10 px-3.5",
        lg: "min-h-11 px-4",
        icon: "h-10 min-h-10 w-10 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export function Button({ className, variant, size, asChild = false, pendingLabel = "Working...", children, disabled, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const Component = asChild ? Slot : "button";
  const isSubmitting = !asChild && props.type === "submit" && pending;
  return <Component className={cn(buttonVariants({ variant, size }), className)} aria-busy={isSubmitting || undefined} disabled={disabled || isSubmitting} {...props}>{isSubmitting ? pendingLabel : children}</Component>;
}
