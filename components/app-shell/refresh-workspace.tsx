"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refreshes server data when staff return to the tab. Renders nothing. */
export function RefreshWorkspace() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
