"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FormDisclosure({
  title,
  buttonLabel,
  children,
  defaultOpen = false,
}: {
  title: string;
  buttonLabel: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">{title}</h2>
        <Button type="button" variant={open ? "default" : "outline"} onClick={() => setOpen((value) => !value)} className="gap-2">
          <Plus size={16} aria-hidden="true" />
          {buttonLabel}
        </Button>
      </div>
      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
