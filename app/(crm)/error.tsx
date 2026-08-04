"use client";

import { Button } from "@/components/ui/button";

export default function CrmError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-xl border-y border-[#d9d8d1] py-12">
      <p className="eyebrow">Workspace interrupted</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#171b36]">This view could not be loaded.</h1>
      <p className="mt-4 text-sm leading-6 text-[#707685]">Your data was not changed. Check the connection and try the request again.</p>
      <Button className="mt-7" type="button" onClick={reset}>Try again</Button>
    </div>
  );
}
