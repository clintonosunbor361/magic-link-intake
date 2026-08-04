import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center rounded-[0.8rem] px-4 text-sm font-extrabold transition-[transform,background,color] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d2ff67]/25 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#171b36] text-white hover:-translate-y-px hover:bg-[#242946]",
        outline: "border border-[#cfcec7] bg-white text-[#171b36] hover:-translate-y-px hover:bg-[#f8f8f4]",
        ghost: "min-h-8 px-2 text-[#676d7d] hover:bg-white/60 hover:text-[#171b36]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Button({ className, variant, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant }), className)} {...props} />;
}
