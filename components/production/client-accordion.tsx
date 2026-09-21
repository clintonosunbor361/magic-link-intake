"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function ProductionClientAccordion({
  clientId,
  clientName,
  totalItems,
  completedItems,
  overdueItems,
  defaultOpen,
  children,
}: {
  clientId: string;
  clientName: string;
  totalItems: number;
  completedItems: number;
  overdueItems: number;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const storageKey = `kuartz-production-client-${clientId}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored !== null) setOpen(stored === "open");
  }, [storageKey]);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      window.sessionStorage.setItem(storageKey, next ? "open" : "closed");
      return next;
    });
  }

  const contentId = `production-client-${clientId}`;

  return (
    <section className="overflow-hidden rounded-[0.8rem] border border-kuartz-line bg-white/55">
      <div className="flex items-stretch">
        <button
          type="button"
          className="flex min-h-14 min-w-0 flex-1 flex-col gap-2 px-4 py-3 text-left transition hover:bg-white/75 sm:flex-row sm:items-center sm:justify-between"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={toggle}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
            <span className="truncate text-base font-extrabold text-kuartz-ink">{clientName}</span>
          </span>
          <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-kuartz-secondary sm:justify-end">
            <span>{totalItems} {totalItems === 1 ? "item" : "items"}</span>
            <span className="rounded-full border border-kuartz-line bg-white px-2.5 py-1">
              {completedItems} of {totalItems} completed
            </span>
            {overdueItems ? (
              <span className="rounded-full border border-[#f0b4b4] bg-[#fdf0f0] px-2.5 py-1 text-[#8c1d1d]">
                {overdueItems} overdue
              </span>
            ) : null}
          </span>
        </button>
        <Link
          href={`/clients/${clientId}`}
          className="flex shrink-0 items-center border-l border-kuartz-line px-3 text-xs font-semibold text-kuartz-secondary underline-offset-4 hover:bg-white/75 hover:text-kuartz-ink hover:underline sm:px-4 sm:text-sm"
        >
          View Client
        </Link>
      </div>

      {open ? (
        <div id={contentId} className="border-t border-kuartz-line px-4 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
