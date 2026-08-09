import { CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn("border-y border-kuartz-line py-14 text-center", className)}
      role="status"
      aria-label={title}
    >
      <CircleDashed className="mx-auto text-[#858a96]" strokeWidth={1.4} aria-hidden="true" />
      <h3 className="mt-5 text-lg font-semibold text-kuartz-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-kuartz-secondary">{description}</p>
    </div>
  );
}
