"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientPicker } from "@/components/enquiries/client-picker";

type ClientResult = {
  id: string;
  fullName: string;
  primaryPhone: string;
  email: string | null;
  latestOrderTitle: string | null;
};

export function ClientAttachPanel({ initialSelected = null }: { initialSelected?: ClientResult | null }) {
  const [open, setOpen] = useState(Boolean(initialSelected));

  return (
    <div className="space-y-3">
      {!open ? <input type="hidden" name="existingClientId" value="" /> : null}
      <div className="rounded-[0.95rem] border border-kuartz-line bg-white/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Client</h2>
            <p className="mt-1 text-sm text-kuartz-secondary">
              A new Client will be created from this Enquiry unless you attach it to an existing Client.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)} className="shrink-0 gap-2">
            <Link2 size={16} aria-hidden="true" />
            {open ? "Hide search" : "Attach existing Client"}
          </Button>
        </div>

        {open ? (
          <div className="mt-4 border-t border-kuartz-line pt-4">
            <ClientPicker initialSelected={initialSelected} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
