"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Sending is one server call that both streams the PDF and marks the Invoice Sent, so this cannot
 * download a document without recording that it went out — or record a send that produced nothing.
 */
export function SendInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, { method: "POST" });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "This Invoice could not be sent.");
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition");
      const filename = disposition?.match(/filename="([^"]+)"/i)?.[1] ?? `${invoiceId}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      router.refresh();
    } catch {
      setError("This Invoice could not be sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4">
      <Button className="w-full" type="button" onClick={send} disabled={sending}>
        {sending ? "Preparing PDF…" : "Mark sent & download PDF"}
      </Button>
      {error ? (
        <p className="form-alert mt-3" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
