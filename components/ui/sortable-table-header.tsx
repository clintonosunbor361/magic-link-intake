import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDirection } from "@/lib/orders/repository";

export function SortableTableHeader({
  href,
  active,
  direction,
  children,
}: {
  href: string;
  active: boolean;
  direction: SortDirection;
  children: ReactNode;
}) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  const nextDirection = active && direction === "asc" ? "descending" : "ascending";

  return (
    <Link
      href={href}
      className="inline-flex min-h-8 items-center gap-1.5 font-extrabold text-kuartz-ink transition hover:text-kuartz-secondary"
      title={`Sort ${nextDirection}`}
    >
      <span>{children}</span>
      <Icon size={14} aria-hidden="true" className={active ? "text-kuartz-ink" : "text-kuartz-muted"} />
    </Link>
  );
}
