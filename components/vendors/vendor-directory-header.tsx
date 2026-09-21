"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VendorDirectoryHeader({ children, error }: { children: ReactNode; error?: string }) {
  const [open, setOpen] = useState(Boolean(error));
  const [mounted, setMounted] = useState(false);
  const dirtyRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => setMounted(true), []);

  function closeDialog() {
    if (dirtyRef.current && !window.confirm("Discard the vendor information you entered?")) return;
    setOpen(false);
    dirtyRef.current = false;
    if (error) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("error");
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    }
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open || !mounted) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mounted]);

  return (
    <>
      <header className="flex flex-col gap-5 border-b border-kuartz-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Vendors</p>
          <h1 className="page-title">Vendors</h1>
          <p className="page-description">Manage vendors, specialties, ratings, and work history.</p>
        </div>
        <Button
          ref={triggerRef}
          type="button"
          className="h-11 min-h-11 w-full self-start gap-2 py-0 sm:w-auto"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <Plus size={17} aria-hidden="true" />
          Add Vendor
        </Button>
      </header>
      {mounted && open ? createPortal(
        <div className="vendor-dialog-root" role="dialog" aria-modal="true" aria-labelledby="add-vendor-title">
          <button
            type="button"
            aria-label="Close add vendor dialog"
            className="vendor-dialog-backdrop"
            onClick={closeDialog}
          />
          <div className="vendor-dialog-panel">
            <div ref={dialogRef} className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-kuartz-line px-5 py-5 sm:px-6">
                <div>
                  <p className="eyebrow">Vendors</p>
                  <h2 id="add-vendor-title" className="mt-2 text-2xl font-extrabold text-kuartz-ink">Add vendor</h2>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Close add vendor dialog"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-kuartz-line bg-white text-kuartz-ink transition hover:border-kuartz-ink"
                  onClick={closeDialog}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div
                className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"
                onChange={() => {
                  dirtyRef.current = true;
                }}
              >
                {error ? <p className="form-alert" role="alert">{error}</p> : null}
                {children}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-kuartz-line bg-[#fbfaf7] px-5 py-4 sm:px-6">
                <Button type="button" variant="ghost" onClick={closeDialog}>Cancel</Button>
                <Button type="submit" form="add-vendor-form">Add Vendor</Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
