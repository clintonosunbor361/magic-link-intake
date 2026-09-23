"use client";

import type { ReactNode } from "react";
import { FormModal } from "@/components/ui/form-modal";

export function VendorDirectoryHeader({ children, error }: { children: ReactNode; error?: string }) {
  return (
    <header className="flex flex-col gap-5 border-b border-kuartz-line pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">Vendors</p>
        <h1 className="page-title">Vendors</h1>
        <p className="page-description">Manage vendors, specialties, ratings, and work history.</p>
      </div>
      <FormModal
        title="Vendors"
        modalTitle="Add vendor"
        buttonLabel="Add Vendor"
        eyebrow="Vendors"
        formId="add-vendor-form"
        submitLabel="Add Vendor"
        pendingLabel="Adding vendor..."
        size="md"
        error={error}
        showSectionTitle={false}
        triggerVariant="default"
        triggerSize="lg"
        triggerClassName="w-full self-start sm:w-auto"
      >
        {children}
      </FormModal>
    </header>
  );
}
