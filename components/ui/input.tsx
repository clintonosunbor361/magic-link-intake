import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("min-h-[3.1rem] w-full rounded-[0.8rem] border border-[#cfcec7] bg-white/70 px-3.5 py-3 text-sm text-[#171b36] outline-none transition-[border-color,box-shadow,background] placeholder:text-[#9195a0] focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-[#d2ff67]/20", className)} {...props} />;
}
