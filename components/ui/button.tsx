"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center rounded-[0.9rem] px-4 text-sm font-extrabold transition-[transform,background,color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kuartz-lime/30 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "border border-kuartz-lime bg-kuartz-lime text-kuartz-ink shadow-[0_14px_34px_rgba(166,211,64,0.22)] hover:-translate-y-px hover:bg-kuartz-limeDeep",
        outline: "border border-kuartz-control bg-white/85 text-kuartz-ink shadow-sm hover:-translate-y-px hover:border-kuartz-ink hover:bg-white",
        ghost: "min-h-8 px-2 text-kuartz-secondary hover:bg-white/70 hover:text-kuartz-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Button({ className, variant, asChild = false, pendingLabel = "Working...", children, disabled, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const Component = asChild ? Slot : "button";
  const isSubmitting = !asChild && props.type === "submit" && pending;
  return <Component className={cn(buttonVariants({ variant }), className)} aria-busy={isSubmitting || undefined} disabled={disabled || isSubmitting} {...props}>{isSubmitting ? pendingLabel : children}</Component>;
}
