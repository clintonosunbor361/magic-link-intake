"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ url, submitAfterCopy = false }: { url: string; submitAfterCopy?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy(event: React.MouseEvent<HTMLButtonElement>) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    if (submitAfterCopy) event.currentTarget.form?.requestSubmit();
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button type="button" variant="outline" onClick={copy} className="gap-2">
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
