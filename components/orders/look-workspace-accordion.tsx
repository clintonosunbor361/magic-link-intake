"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Ellipsis, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LookWorkspaceAccordion({
  orderId,
  lookId,
  name,
  itemCount,
  lookDate,
  archived,
  defaultOpen,
  editAction,
  lifecycleAction,
  addItemForm,
  bulkAssignment,
  children,
}: {
  orderId: string;
  lookId: string;
  name: string;
  itemCount: number;
  lookDate: string | null;
  archived: boolean;
  defaultOpen: boolean;
  editAction?: ReactNode;
  lifecycleAction: ReactNode;
  addItemForm?: ReactNode;
  bulkAssignment?: ReactNode;
  children: ReactNode;
}) {
  const storageKey = `kuartz-order-${orderId}-look-${lookId}`;
  const actionsMenuRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored !== null) setOpen(stored === "open");
  }, [storageKey]);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      if (!next && actionsMenuRef.current) actionsMenuRef.current.open = false;
      window.sessionStorage.setItem(storageKey, next ? "open" : "closed");
      return next;
    });
  }

  const contentId = `order-look-${lookId}`;

  return (
    <section className="rounded-[0.8rem] border border-kuartz-line bg-white/55">
      <div className="flex items-stretch">
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-4 text-left transition hover:bg-white/75 sm:flex-row sm:items-center sm:justify-between"
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
            <span className="truncate text-base font-extrabold text-kuartz-ink">{name}</span>
            {archived ? (
              <span className="rounded-full border border-kuartz-line px-2 py-0.5 text-xs font-bold text-kuartz-muted">
                Archived
              </span>
            ) : null}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-kuartz-secondary sm:justify-end">
            <span className="rounded-full bg-[#f1f4e8] px-2.5 py-1">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            {lookDate ? <span>{lookDate}</span> : null}
          </span>
        </button>

        {editAction || lifecycleAction ? <details ref={actionsMenuRef} className="relative flex shrink-0 items-center border-l border-kuartz-line">
          <summary
            className="flex min-h-full cursor-pointer list-none items-center px-4 text-kuartz-secondary hover:bg-white hover:text-kuartz-ink [&::-webkit-details-marker]:hidden"
            title="Look actions"
            aria-label={`Actions for ${name}`}
          >
            <Ellipsis size={20} aria-hidden="true" />
          </summary>
          <div className="absolute right-2 top-[calc(100%-0.35rem)] z-20 min-w-40 rounded-[0.7rem] border border-kuartz-line bg-white p-1.5 shadow-[0_16px_40px_rgba(24,24,38,0.16)]">
            {editAction}
            {lifecycleAction}
          </div>
        </details> : null}
      </div>

      {open ? (
        <div id={contentId} className="border-t border-kuartz-line px-4 py-4 sm:px-5">
          {addItemForm ? <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-kuartz-ink">Items</h3>
            <div className="flex flex-wrap items-center gap-2">
              {bulkAssignment}
              <Button
                type="button"
                variant={addingItem ? "default" : "outline"}
                onClick={() => setAddingItem((current) => !current)}
                className="gap-2"
              >
                {addingItem ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                {addingItem ? "Close" : "Add Item"}
              </Button>
            </div>
          </div> : null}

          {addingItem && addItemForm ? (
            <div className="mt-4 rounded-[0.8rem] border border-kuartz-line bg-[#fbfaf7] p-4">{addItemForm}</div>
          ) : null}

          <div className={addItemForm ? "mt-4 space-y-3" : "space-y-3"}>{children}</div>
        </div>
      ) : null}
    </section>
  );
}

export function OrderItemDisclosure({
  label,
  typeName,
  quantity,
  vendorName,
  productionStatus,
  archived,
  warning,
  editForm,
  lifecycleAction,
  assignment,
}: {
  label: string;
  typeName: string;
  quantity: number;
  vendorName: string | null;
  productionStatus: string | null;
  archived: boolean;
  warning: ReactNode;
  editForm: ReactNode;
  lifecycleAction: ReactNode;
  assignment: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <article className="rounded-[0.75rem] border border-kuartz-line bg-white/70 px-4 py-3.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h4 className="font-extrabold text-kuartz-ink">{label}</h4>
            {label !== typeName ? <span className="text-sm text-kuartz-secondary">{typeName}</span> : null}
            {archived ? <span className="text-xs font-semibold text-kuartz-muted">Archived</span> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-kuartz-secondary">
            <span>Qty {quantity}</span>
            <span>{vendorName ?? "No Vendor assigned"}</span>
            {productionStatus ? <span>{productionStatus}</span> : null}
          </div>
          {warning}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <Button type="button" variant="ghost" onClick={() => setEditing((current) => !current)} className="gap-2">
            {editing ? <X size={15} aria-hidden="true" /> : <Pencil size={15} aria-hidden="true" />}
            {editing ? "Close" : "Edit"}
          </Button>
          {lifecycleAction}
        </div>
      </div>

      {editing ? (
        <div className="mt-4 border-t border-kuartz-line pt-4">{editForm}</div>
      ) : null}
      {!archived ? <div className="mt-3">{assignment}</div> : null}
    </article>
  );
}
