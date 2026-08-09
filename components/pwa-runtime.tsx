"use client";

import { useEffect, useState } from "react";

export function PwaRuntime() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      Promise.resolve(navigator.serviceWorker.register("/sw.js"))
        .then((registration) => registration?.update())
        .catch(() => {
          // The app remains fully usable online when registration is unavailable.
        });
    }
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  return offline ? <div className="offline-banner" role="status" aria-live="polite">You’re offline. Kuartz is unavailable until the connection returns.</div> : null;
}
