"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildVendorBriefDocument,
  defaultBriefSelection,
  emptyBriefEdits,
  MAX_BRIEF_IMAGES,
  type VendorBriefEdits,
  type VendorBriefSelection,
  type VendorBriefSources,
} from "@/lib/vendor-briefs/document";

// The HTML half of the two renderers. It builds the very same VendorBriefDocument the PDF is made
// from, so the preview is not an approximation — the content is identical and only the layout
// differs. Selection is made fresh each time this screen is opened; nothing is remembered on the
// assignment.

export function BriefBuilder({
  assignmentId,
  sources,
  blocker,
  canOverride,
}: {
  assignmentId: string;
  sources: VendorBriefSources;
  blocker: { missingLabels: string[] } | null;
  canOverride: boolean;
}) {
  const [selection, setSelection] = useState<VendorBriefSelection>(() => defaultBriefSelection(sources));
  const [edits, setEdits] = useState<VendorBriefEdits>(emptyBriefEdits);
  const [overrideReason, setOverrideReason] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = buildVendorBriefDocument({ sources, selection, edits });
  const imageLimitReached = selection.imageRevisionIds.length >= MAX_BRIEF_IMAGES;

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
  }

  async function exportPdf() {
    setExporting(true);
    setError(null);
    try {
      const response = await fetch(`/api/vendor-briefs/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection, edits, overrideReason: overrideReason || undefined }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "The brief could not be exported.");
        return;
      }

      // The PDF is streamed, never stored: it goes straight from the response to a download.
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vendor-brief-${assignmentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("The brief could not be exported. Check your connection and try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid gap-10 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-8">
        <div>
          <h2 className="section-title">What to include</h2>
          <p className="mt-2 text-sm leading-6 text-kuartz-secondary">
            Choose this fresh for every export. Nothing is remembered between briefs.
          </p>

          <fieldset className="mt-4 space-y-2.5 border-t border-kuartz-line pt-5">
            <legend className="sr-only">Details</legend>
            <Checkbox
              label="Client name"
              checked={selection.includeClientName}
              onChange={(checked) => setSelection({ ...selection, includeClientName: checked })}
            />
            <Checkbox
              label="Quantity"
              checked={selection.includeQuantity}
              onChange={(checked) => setSelection({ ...selection, includeQuantity: checked })}
            />
            <Checkbox
              label="Production deadline"
              checked={selection.includeDeadline}
              onChange={(checked) => setSelection({ ...selection, includeDeadline: checked })}
            />
          </fieldset>
        </div>

        {sources.measurements.length ? (
          <fieldset>
            <legend className="section-title">Measurements</legend>
            <div className="mt-4 space-y-2.5 border-t border-kuartz-line pt-5">
              {sources.measurements.map((measurement) => (
                <Checkbox
                  key={measurement.fieldDefinitionId}
                  label={`${measurement.label}${measurement.value ? "" : " — not recorded"}`}
                  checked={selection.measurementFieldIds.includes(measurement.fieldDefinitionId)}
                  onChange={() =>
                    setSelection({
                      ...selection,
                      measurementFieldIds: toggle(selection.measurementFieldIds, measurement.fieldDefinitionId),
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        {sources.notes.length ? (
          <fieldset>
            <legend className="section-title">Consultation notes</legend>
            <p className="mt-2 text-sm leading-6 text-kuartz-secondary">
              Nothing is included by default — tick only what this Vendor needs.
            </p>
            <div className="mt-4 space-y-2.5 border-t border-kuartz-line pt-5">
              {sources.notes.map((note) => (
                <Checkbox
                  key={note.id}
                  label={`${note.sourceLabel} · ${note.recordedOn}`}
                  description={note.body}
                  checked={selection.noteIds.includes(note.id)}
                  onChange={() => setSelection({ ...selection, noteIds: toggle(selection.noteIds, note.id) })}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        {sources.images.length ? (
          <fieldset>
            <legend className="section-title">References</legend>
            <p className="mt-2 text-sm leading-6 text-kuartz-secondary">
              Up to {MAX_BRIEF_IMAGES} images are embedded in the PDF so the Vendor gets one
              self-contained file.
            </p>
            <div className="mt-4 space-y-2.5 border-t border-kuartz-line pt-5">
              {sources.images.map((image) => {
                const checked = selection.imageRevisionIds.includes(image.revisionId);
                return (
                  <Checkbox
                    key={image.revisionId}
                    label={image.label}
                    checked={checked}
                    disabled={!checked && imageLimitReached}
                    onChange={() =>
                      setSelection({
                        ...selection,
                        imageRevisionIds: toggle(selection.imageRevisionIds, image.revisionId),
                      })
                    }
                  />
                );
              })}
              {imageLimitReached ? (
                <p className="text-xs font-semibold text-kuartz-muted" role="status">
                  Limit of {MAX_BRIEF_IMAGES} images reached.
                </p>
              ) : null}
            </div>
          </fieldset>
        ) : null}
      </div>

      <div className="space-y-8">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="section-title">Preview</h2>
            <p className="text-xs font-semibold uppercase tracking-wider text-kuartz-muted">
              Edits apply to this PDF only
            </p>
          </div>

          <article className="mt-4 rounded-[1rem] border border-kuartz-line bg-white/70 p-5 sm:p-7">
            <p className="eyebrow">Vendor Brief</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-kuartz-ink">
              {preview.itemLabel ?? preview.itemTypeName}
            </h3>
            <p className="mt-1 text-sm text-kuartz-secondary">
              For {preview.vendorName}
              {preview.vendorPhone ? ` · ${preview.vendorPhone}` : ""}
            </p>

            <dl className="mt-6 grid gap-4 border-t border-[#e6e5df] pt-5 sm:grid-cols-2">
              <Fact label="Item type" value={preview.itemTypeName} />
              <Fact label="Look" value={preview.lookName} />
              <Fact label="Order" value={preview.orderReference} />
              {preview.quantity !== null ? <Fact label="Quantity" value={String(preview.quantity)} /> : null}
              {preview.deadline !== null ? <Fact label="Deadline" value={preview.deadline} /> : null}
              {preview.clientName !== null ? <Fact label="Client" value={preview.clientName} /> : null}
            </dl>

            {preview.measurements.length ? (
              <section className="mt-6 border-t border-[#e6e5df] pt-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-kuartz-muted">Measurements</h4>
                <ul className="mt-3 divide-y divide-[#eceae4]">
                  {sources.measurements
                    .filter((measurement) => selection.measurementFieldIds.includes(measurement.fieldDefinitionId))
                    .map((measurement) => (
                      <li
                        key={measurement.fieldDefinitionId}
                        className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                      >
                        <label className="text-sm text-kuartz-body" htmlFor={`m-${measurement.fieldDefinitionId}`}>
                          {measurement.label}
                        </label>
                        <span className="flex items-center gap-2">
                          <Input
                            id={`m-${measurement.fieldDefinitionId}`}
                            className="h-10 w-28 min-h-0"
                            defaultValue={measurement.value ?? ""}
                            onChange={(event) =>
                              setEdits({
                                ...edits,
                                measurementValues: {
                                  ...edits.measurementValues,
                                  [measurement.fieldDefinitionId]: event.target.value,
                                },
                              })
                            }
                          />
                          <span className="text-sm text-kuartz-muted">{measurement.unit}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}

            {preview.notes.length ? (
              <section className="mt-6 border-t border-[#e6e5df] pt-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-kuartz-muted">Consultation notes</h4>
                <ul className="mt-3 space-y-4">
                  {sources.notes
                    .filter((note) => selection.noteIds.includes(note.id))
                    .map((note) => (
                      <li key={note.id}>
                        <p className="text-xs text-kuartz-muted">
                          {note.sourceLabel} · {note.recordedOn}
                        </p>
                        <textarea
                          className="mt-1 min-h-[4.5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-2.5 text-sm leading-6 text-kuartz-ink outline-none transition-[border-color,box-shadow,background] focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
                          defaultValue={note.body}
                          aria-label={`Note from ${note.sourceLabel}`}
                          onChange={(event) =>
                            setEdits({
                              ...edits,
                              noteBodies: { ...edits.noteBodies, [note.id]: event.target.value },
                            })
                          }
                        />
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}

            <section className="mt-6 border-t border-[#e6e5df] pt-5">
              <label className="form-group">
                <span>
                  Additional instructions <span className="font-normal text-kuartz-secondary">(optional)</span>
                </span>
                <textarea
                  className="min-h-[5rem] w-full rounded-[0.8rem] border border-kuartz-control bg-white/70 px-3.5 py-2.5 text-sm leading-6 text-kuartz-ink outline-none transition-[border-color,box-shadow,background] focus:border-[#88925f] focus:bg-white focus:ring-4 focus:ring-kuartz-lime/20"
                  value={edits.additionalInstructions}
                  onChange={(event) => setEdits({ ...edits, additionalInstructions: event.target.value })}
                />
              </label>
            </section>

            {preview.images.length ? (
              <p className="mt-6 border-t border-[#e6e5df] pt-5 text-sm text-kuartz-secondary">
                {preview.images.length} {preview.images.length === 1 ? "reference" : "references"} will be
                embedded on a second page.
              </p>
            ) : null}
          </article>
        </div>

        <div className="border-t border-kuartz-line pt-6">
          {blocker ? (
            <div className="rounded-[0.8rem] border border-[#f0b4b4] bg-[#fdf0f0] px-4 py-3.5">
              <p className="text-sm font-semibold text-[#8c1d1d]">
                Missing required measurements: {blocker.missingLabels.join(", ")}
              </p>
              {canOverride ? (
                <label className="form-group mt-3">
                  <span>Override reason</span>
                  <Input
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    placeholder="Vendor starts cutting today"
                    required
                  />
                  <small>
                    Recorded against this export in the audit log. The next export is checked again
                    from scratch.
                  </small>
                </label>
              ) : (
                <p className="mt-2 text-sm leading-6 text-[#8c1d1d]">
                  A Super Admin must override this block before the brief can be exported.
                </p>
              )}
            </div>
          ) : null}

          {error ? (
            <p className="form-alert mt-4" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            className="mt-4 w-full sm:w-auto"
            onClick={exportPdf}
            disabled={exporting || (blocker !== null && (!canOverride || !overrideReason.trim()))}
          >
            {exporting ? "Preparing PDF…" : "Export PDF"}
          </Button>
          <p className="mt-2 text-xs text-kuartz-muted" role="status" aria-live="polite">
            {exporting
              ? "Fetching references and rendering — this can take a few seconds."
              : "The PDF is generated on demand and never stored."}
          </p>
        </div>
      </div>
    </div>
  );
}

function Checkbox({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-2.5 text-sm font-medium ${disabled ? "text-[#a3a7b2]" : "cursor-pointer text-kuartz-body"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-[#88925f] disabled:cursor-not-allowed"
      />
      <span>
        {label}
        {description ? (
          <span className="mt-0.5 block font-normal leading-6 text-kuartz-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-kuartz-muted">{label}</dt>
      <dd className="mt-1 text-kuartz-ink">{value}</dd>
    </div>
  );
}
