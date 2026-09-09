"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshWorkspace() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return <Button type="button" variant="ghost" disabled={pending} aria-label="Refresh workspace" onClick={() => startTransition(() => router.refresh())}>
    <RefreshCw className="h-4 w-4" aria-hidden="true" />
    <span className="hidden sm:inline">{pending ? "Refreshing…" : "Refresh"}</span>
  </Button>;
}
