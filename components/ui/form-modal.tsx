"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FormModal({
  title,
  modalTitle,
  buttonLabel,
  children,
  error,
  showSectionTitle = true,
}: {
  title: string;
  modalTitle?: string;
  buttonLabel: string;
  children: ReactNode;
  error?: string;
  showSectionTitle?: boolean;
}) {
  const dialogTitle = modalTitle ?? title;
  const [open, setOpen] = useState(Boolean(error));
  const [mounted, setMounted] = useState(false);
  const dirtyRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  function closeModal() {
    if (dirtyRef.current && !window.confirm("Discard the information you entered?")) return;
    dirtyRef.current = false;
    setOpen(false);
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
        closeModal();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
        ),
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
      <div className={showSectionTitle ? "flex items-center justify-between gap-4" : undefined}>
        {showSectionTitle ? <h2 className="section-title">{title}</h2> : null}
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          className="gap-2"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Plus size={16} aria-hidden="true" />
          {buttonLabel}
        </Button>
      </div>

      {mounted && open
        ? createPortal(
            <div className="form-modal-root" role="dialog" aria-modal="true" aria-labelledby="form-modal-title">
              <button type="button" aria-label={`Close ${dialogTitle}`} className="form-modal-backdrop" onClick={closeModal} />
              <div className="form-modal-panel">
                <div ref={dialogRef} className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-4 border-b border-kuartz-line px-5 py-5 sm:px-6">
                    <div>
                      <p className="eyebrow">New entry</p>
                      <h2 id="form-modal-title" className="mt-2 text-2xl font-extrabold text-kuartz-ink">{dialogTitle}</h2>
                    </div>
                    <button
                      ref={closeRef}
                      type="button"
                      aria-label={`Close ${dialogTitle}`}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-kuartz-line bg-white text-kuartz-ink transition hover:border-kuartz-ink"
                      onClick={closeModal}
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
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
