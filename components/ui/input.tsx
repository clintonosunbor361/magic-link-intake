import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("min-h-[3.15rem] w-full rounded-[0.95rem] border border-kuartz-control bg-white/78 px-3.5 py-3 text-sm text-kuartz-ink shadow-sm outline-none transition-[border-color,box-shadow,background,transform] placeholder:text-[#8d97a8] hover:border-[#aab8cc] hover:bg-white focus:border-[#8492a9] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20 focus:-translate-y-px", className)} {...props} />;
}
