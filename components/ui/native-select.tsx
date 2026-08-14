import * as React from "react";
import { cn } from "@/lib/utils";

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn("native-select min-h-[3.15rem] w-full rounded-[0.95rem] border border-kuartz-control bg-white/78 px-3.5 py-2.5 text-sm text-kuartz-ink shadow-sm outline-none transition-[border-color,box-shadow,background,transform] hover:border-[#aab8cc] hover:bg-white focus:border-[#8492a9] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20 focus:-translate-y-px", className)} {...props} />;
}

