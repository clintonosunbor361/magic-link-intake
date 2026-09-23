"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ModalSize = "sm" | "md" | "lg";

export function FormModal({
  title,
  modalTitle,
  buttonLabel,
  children,
  error,
  showSectionTitle = true,
  eyebrow,
  formId,
  submitLabel,
  pendingLabel = "Saving...",
  size = "md",
  triggerVariant = "outline",
  triggerClassName,
}: {
  title: string;
  modalTitle?: string;
  buttonLabel: string;
  children: ReactNode;
  error?: string;
  showSectionTitle?: boolean;
  eyebrow?: string;
  formId: string;
  submitLabel: string;
  pendingLabel?: string;
  size?: ModalSize;
  triggerVariant?: "default" | "outline" | "ghost";
  triggerClassName?: string;
}) {
  const dialogTitle = modalTitle ?? title;
  const id = useId();
  const titleId = `${id}-title`;
  const errorId = `${id}-error`;
  const discardTitleId = `${id}-discard-title`;
  const [open, setOpen] = useState(Boolean(error));
  const [mounted, setMounted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dirtyRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!error) return;
    setSubmitting(false);
    setOpen(true);
  }, [error]);

  function clearErrorQuery() {
    if (!error) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    params.delete("modal");
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  function finishClose() {
    dirtyRef.current = false;
    setConfirmDiscard(false);
    setSubmitting(false);
    setOpen(false);
    clearErrorQuery();
    triggerRef.current?.focus();
  }

  function requestClose() {
    if (submitting) return;
    if (dirtyRef.current) {
      setConfirmDiscard(true);
      return;
    }
    finishClose();
  }

  useEffect(() => {
    if (!open || !mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTarget = window.requestAnimationFrame(() => {
      if (errorRef.current) {
        errorRef.current.focus();
        return;
      }
      const firstField = dialogRef.current?.querySelector<HTMLElement>(
        '[data-modal-autofocus], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      (firstField ?? closeRef.current)?.focus();
    });
    return () => {
      window.cancelAnimationFrame(focusTarget);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mounted, error]);

  useEffect(() => {
    if (confirmDiscard) keepEditingRef.current?.focus();
  }, [confirmDiscard]);

  useEffect(() => {
    if (!open || !mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (confirmDiscard) setConfirmDiscard(false);
        else requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const container = confirmDiscard ? document.getElementById(`${id}-discard`) : dialogRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
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
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmDiscard, id, mounted, open, submitting]);

  return (
    <>
      <div className={showSectionTitle ? "flex items-center justify-between gap-4" : undefined}>
        {showSectionTitle ? <h2 className="section-title">{title}</h2> : null}
        <Button
          ref={triggerRef}
          type="button"
          variant={triggerVariant}
          className={`gap-2 ${triggerClassName ?? ""}`}
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
            <div className="form-modal-root" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={error ? errorId : undefined}>
              <div className="form-modal-backdrop" onMouseDown={requestClose} aria-hidden="true" />
              <div className={`form-modal-panel form-modal-panel-${size}`}>
                <div ref={dialogRef} className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-4 border-b border-kuartz-line px-5 py-5 sm:px-6">
                    <div>
                      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
                      <h2 id={titleId} className={eyebrow ? "mt-2 text-2xl font-extrabold text-kuartz-ink" : "text-2xl font-extrabold text-kuartz-ink"}>
                        {dialogTitle}
                      </h2>
                    </div>
                    <button
                      ref={closeRef}
                      type="button"
                      aria-label={`Close ${dialogTitle}`}
                      className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-kuartz-line bg-white text-kuartz-ink transition-colors hover:border-kuartz-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kuartz-lime/30"
                      onClick={requestClose}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"
                    onChange={() => {
                      dirtyRef.current = true;
                    }}
                    onSubmitCapture={() => setSubmitting(true)}
                  >
                    {error ? <p ref={errorRef} id={errorId} tabIndex={-1} className="form-alert" role="alert">{error}</p> : null}
                    {children}
                  </div>
                  <div className="form-modal-footer">
                    <Button type="button" variant="ghost" disabled={submitting} onClick={requestClose}>Cancel</Button>
                    <Button type="submit" form={formId} disabled={submitting} aria-busy={submitting || undefined}>
                      {submitting ? pendingLabel : submitLabel}
                    </Button>
                  </div>
                </div>
              </div>

              {confirmDiscard ? (
                <div className="form-modal-confirm-layer">
                  <div id={`${id}-discard`} className="form-modal-confirm" role="alertdialog" aria-modal="true" aria-labelledby={discardTitleId}>
                    <h3 id={discardTitleId} className="text-lg font-extrabold text-kuartz-ink">Discard changes?</h3>
                    <p className="mt-2 text-sm leading-6 text-kuartz-secondary">The information entered in this form will be lost.</p>
                    <div className="mt-5 flex justify-end gap-3">
                      <Button ref={keepEditingRef} type="button" variant="outline" onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
                      <Button
                        type="button"
                        className="border border-[#e2b5b2] bg-[#fff4f3] text-[#7e403d] shadow-none hover:bg-[#fbe5e3]"
                        onClick={finishClose}
                      >
                        Discard
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
