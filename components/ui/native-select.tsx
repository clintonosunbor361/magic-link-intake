import * as React from "react";
import { cn } from "@/lib/utils";

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn("min-h-[3.1rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-2.5 text-sm text-kuartz-ink outline-none transition-[border-color,box-shadow,background] focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20", className)} {...props} />;
}
