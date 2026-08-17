"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type CreateLinkResponse = {
  url: string;
};

export function LinkGenerator() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const isBusy = isGenerating || isPending;

  async function generateLink() {
    setError("");
    setCopied(false);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/intake-links", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to generate a link.");
      }

      const data = (await response.json()) as CreateLinkResponse;
      setGeneratedUrl(data.url);
      startTransition(() => router.refresh());
    } catch {
      setError("Could not generate a link. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyLink() {
    if (!generatedUrl) {
      return;
    }

    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="w-full max-w-full space-y-3 sm:w-72">
      <Button
        type="button"
        variant="outline"
        onClick={generateLink}
        disabled={isBusy}
        className="w-full gap-2"
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        )}
        Generate intake link
      </Button>

      {generatedUrl ? (
        <div className="max-w-full overflow-hidden rounded-[1rem] border border-kuartz-line bg-white/75 p-3 shadow-sm backdrop-blur-xl">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 items-center gap-2 rounded-[0.8rem] border border-kuartz-line/80 bg-white/70 px-3 py-2.5 text-sm text-kuartz-muted backdrop-blur-xl">
              <Link2 className="h-4 w-4 shrink-0 text-kuartz-graphite" aria-hidden="true" />
              <span className="truncate">{generatedUrl}</span>
            </div>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[0.8rem] border border-kuartz-line bg-white/70 px-4 py-2 text-sm font-semibold text-kuartz-graphite shadow-sm backdrop-blur-xl transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-slate-300/25"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-kuartz-line bg-white/65 px-4 py-3 text-sm font-medium text-kuartz-graphite">
          {error}
        </p>
      ) : null}
    </div>
  );
}
