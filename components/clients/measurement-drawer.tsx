"use client";

import { useState } from "react";
import { Ruler, X } from "lucide-react";
import { createMeasurementFieldDefinitionAction } from "@/app/actions/measurement-field-definitions";
import { setMeasurementValuesAction } from "@/app/actions/measurement-profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MeasurementFieldView = {
  fieldId: string;
  fieldName: string;
  unit: string;
  value: string | null;
  version: number;
};

export function MeasurementDrawer({
  clientId,
  measurementProfileId,
  fields,
  disabled,
  returnTo,
  canAddCustomFields = false,
}: {
  clientId: string;
  measurementProfileId: string;
  fields: MeasurementFieldView[];
  disabled?: boolean;
  returnTo?: string;
  canAddCustomFields?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const targetPath = returnTo ?? `/clients/${clientId}`;
  const nextSortOrder = fields.length ? fields.length + 1 : 1;
  const hasRecordedMeasurements = fields.some((field) => field.value);

  return (
    <>
      <Button type="button" variant="outline" className="gap-2" disabled={disabled} onClick={() => setOpen(true)}>
        <Ruler size={16} aria-hidden="true" />
        Add measurements
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="measurement-drawer-title">
          <button
            type="button"
            aria-label="Close measurements drawer"
            className="absolute inset-0 cursor-default bg-kuartz-ink/38 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-[42rem] flex-col border-l border-kuartz-line bg-[#fbfaf7] shadow-[0_24px_90px_rgba(21,22,63,0.22)]">
            <div className="flex items-start justify-between gap-4 border-b border-kuartz-line px-5 py-5 sm:px-6">
              <div>
                <p className="eyebrow">Measurements</p>
                <h2 id="measurement-drawer-title" className="mt-2 text-2xl font-extrabold text-kuartz-ink">
                  {hasRecordedMeasurements ? "Edit measurements" : "Add measurements"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close measurements drawer"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-kuartz-line bg-white text-kuartz-ink transition hover:border-kuartz-ink"
                onClick={() => setOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {canAddCustomFields ? (
                <form action={createMeasurementFieldDefinitionAction} className="mb-5 rounded-[0.95rem] border border-kuartz-line bg-white/78 p-4">
                  <input type="hidden" name="returnTo" value={targetPath} />
                  <input type="hidden" name="sortOrder" value={nextSortOrder} />
                  <p className="text-sm font-extrabold text-kuartz-ink">Add custom field</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
                    <label className="form-group">
                      <span>Field name</span>
                      <Input name="name" placeholder="e.g. Cap size" required />
                    </label>
                    <label className="form-group">
                      <span>Unit</span>
                      <Input name="unit" placeholder="in" required />
                    </label>
                    <Button type="submit" variant="outline">
                      Add field
                    </Button>
                  </div>
                </form>
              ) : null}

              <form action={setMeasurementValuesAction} id="measurement-values-form">
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="measurementProfileId" value={measurementProfileId} />
                <input type="hidden" name="returnTo" value={targetPath} />
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field.fieldId} className="rounded-[0.95rem] border border-kuartz-line bg-white/78 p-4">
                      <input type="hidden" name="fieldDefinitionId" value={field.fieldId} />
                      <input type="hidden" name={`version:${field.fieldId}`} value={field.version} />
                      <input type="hidden" name={`previousValue:${field.fieldId}`} value={field.value ?? ""} />
                      <label className="form-group">
                        <span>
                          {field.fieldName} <span className="font-normal text-kuartz-muted">({field.unit})</span>
                        </span>
                        <Input name={`value:${field.fieldId}`} defaultValue={field.value ?? ""} />
                      </label>
                      <label className="form-group mt-3">
                        <span>
                          Note <span className="font-normal text-kuartz-secondary">(optional)</span>
                        </span>
                        <Input name={`note:${field.fieldId}`} />
                      </label>
                    </div>
                  ))}
                </div>
              </form>
            </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-kuartz-line bg-white/76 px-5 py-4 sm:px-6">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" form="measurement-values-form">
                  Save measurements
                </Button>
              </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
