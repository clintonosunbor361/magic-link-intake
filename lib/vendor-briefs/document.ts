import { computeMissingFieldIds } from "@/lib/item-type-measurement-requirements/rules";

// One typed payload, two renderers. The HTML preview and the PDF are laid out differently but are
// built from the same VendorBriefDocument, so what a person reviews on screen is what leaves the
// building. Everything here is pure — the export route resolves sources and images, then calls in.
//
// Phase 1 stores neither the PDF nor a snapshot of this payload. It is assembled fresh on every
// export from live records, which is also why field selection is made fresh each time rather than
// remembered on the assignment.

export const BRIEF_SECTIONS = ["header", "item", "measurements", "notes", "references"] as const;
export type BriefSection = (typeof BRIEF_SECTIONS)[number];

export const MAX_BRIEF_IMAGES = 8;

export type BriefMeasurement = {
  fieldDefinitionId: string;
  label: string;
  unit: string;
  value: string | null;
  required: boolean;
};

export type BriefNote = {
  id: string;
  sourceLabel: string;
  body: string;
  recordedOn: string;
};

export type BriefImage = {
  revisionId: string;
  label: string;
  mimeType: string;
};

export type VendorBriefSources = {
  vendorName: string;
  vendorPhone: string | null;
  clientName: string;
  orderReference: string;
  lookName: string;
  itemTypeName: string;
  itemLabel: string | null;
  quantity: number;
  deadline: string;
  measurements: BriefMeasurement[];
  // Consultation notes are brief-eligible: the spec's own note rules describe notes being "used in
  // a vendor brief". Production notes are not, and are never passed in here.
  notes: BriefNote[];
  images: BriefImage[];
};

export type VendorBriefSelection = {
  includeClientName: boolean;
  includeQuantity: boolean;
  includeDeadline: boolean;
  measurementFieldIds: string[];
  noteIds: string[];
  imageRevisionIds: string[];
};

// Preview-only overrides. Editing here changes this PDF and nothing else — a brief edit is usually
// a one-off production adjustment (extra ease for a stiff fabric), not a correction to the client's
// recorded measurement. Genuine corrections belong in the Measurements area, where they get a
// revision trail. Nothing in this module writes to a source record.
export type VendorBriefEdits = {
  measurementValues: Record<string, string>;
  noteBodies: Record<string, string>;
  additionalInstructions: string;
};

export type VendorBriefDocument = {
  vendorName: string;
  vendorPhone: string | null;
  clientName: string | null;
  orderReference: string;
  lookName: string;
  itemTypeName: string;
  itemLabel: string | null;
  quantity: number | null;
  deadline: string | null;
  measurements: { label: string; unit: string; value: string; required: boolean }[];
  notes: { sourceLabel: string; recordedOn: string; body: string }[];
  images: BriefImage[];
  additionalInstructions: string | null;
};

export function emptyBriefEdits(): VendorBriefEdits {
  return { measurementValues: {}, noteBodies: {}, additionalInstructions: "" };
}

export function defaultBriefSelection(sources: VendorBriefSources): VendorBriefSelection {
  return {
    includeClientName: false,
    includeQuantity: true,
    includeDeadline: true,
    // Required measurements are ticked by default because they are what the vendor needs to cut.
    // Notes and images start unticked: nothing internal leaves the building unless someone chooses
    // it for this specific export.
    measurementFieldIds: sources.measurements
      .filter((measurement) => measurement.required)
      .map((measurement) => measurement.fieldDefinitionId),
    noteIds: [],
    imageRevisionIds: [],
  };
}

export function buildVendorBriefDocument(input: {
  sources: VendorBriefSources;
  selection: VendorBriefSelection;
  edits: VendorBriefEdits;
}): VendorBriefDocument {
  const { sources, selection, edits } = input;

  const selectedMeasurementIds = new Set(selection.measurementFieldIds);
  const selectedNoteIds = new Set(selection.noteIds);
  const selectedImageIds = new Set(selection.imageRevisionIds);

  const measurements = sources.measurements
    .filter((measurement) => selectedMeasurementIds.has(measurement.fieldDefinitionId))
    .map((measurement) => ({
      label: measurement.label,
      unit: measurement.unit,
      value: (edits.measurementValues[measurement.fieldDefinitionId] ?? measurement.value ?? "").trim(),
      required: measurement.required,
    }))
    .filter((measurement) => measurement.value.length > 0);

  const notes = sources.notes
    .filter((note) => selectedNoteIds.has(note.id))
    .map((note) => ({
      sourceLabel: note.sourceLabel,
      recordedOn: note.recordedOn,
      body: (edits.noteBodies[note.id] ?? note.body).trim(),
    }))
    .filter((note) => note.body.length > 0);

  const images = sources.images
    .filter((image) => selectedImageIds.has(image.revisionId))
    .slice(0, MAX_BRIEF_IMAGES);

  const additionalInstructions = edits.additionalInstructions.trim();

  return {
    vendorName: sources.vendorName,
    vendorPhone: sources.vendorPhone,
    clientName: selection.includeClientName ? sources.clientName : null,
    orderReference: sources.orderReference,
    lookName: sources.lookName,
    itemTypeName: sources.itemTypeName,
    itemLabel: sources.itemLabel,
    quantity: selection.includeQuantity ? sources.quantity : null,
    deadline: selection.includeDeadline ? sources.deadline : null,
    measurements,
    notes,
    images,
    additionalInstructions: additionalInstructions.length ? additionalInstructions : null,
  };
}

export type BriefBlocker = {
  missingFieldIds: string[];
  missingLabels: string[];
};

/**
 * Export is blocked when the Item's type requires measurements the Client's profile does not have.
 * Assignment itself is never blocked — the spec is explicit that a Vendor can be assigned before
 * confirmations are complete — so this gates the PDF route only, and the workspace shows a
 * non-blocking badge.
 *
 * Values supplied as preview edits do not clear a blocker: the brief would then carry a number that
 * exists nowhere in the client's record.
 */
export function computeBriefBlocker(sources: VendorBriefSources): BriefBlocker | null {
  const requiredFieldIds = sources.measurements
    .filter((measurement) => measurement.required)
    .map((measurement) => measurement.fieldDefinitionId);

  const presentFieldIds = sources.measurements
    .filter((measurement) => measurement.value !== null && measurement.value.trim().length > 0)
    .map((measurement) => measurement.fieldDefinitionId);

  const missingFieldIds = computeMissingFieldIds(requiredFieldIds, presentFieldIds);
  if (!missingFieldIds.length) return null;

  const labels = new Map(sources.measurements.map((m) => [m.fieldDefinitionId, m.label]));
  return {
    missingFieldIds,
    missingLabels: missingFieldIds.map((id) => labels.get(id) ?? "Unknown measurement"),
  };
}

/**
 * The override is one-shot and scoped to a single export: the reason is captured in the same server
 * call that streams the PDF, and the next export re-runs the check from scratch. A sticky override
 * would let a brief exported weeks later silently omit a measurement that became required in the
 * meantime.
 */
export function resolveExportPermission(input: {
  blocker: BriefBlocker | null;
  role: "super_admin" | "admin_assistant";
  overrideReason: string | null;
}): { allowed: true; overrideReason: string | null } {
  if (!input.blocker) return { allowed: true, overrideReason: null };

  if (input.role !== "super_admin") {
    throw new Error(
      `Required measurements are missing (${input.blocker.missingLabels.join(", ")}). A Super Admin must override to export.`,
    );
  }

  const reason = (input.overrideReason ?? "").trim();
  if (!reason) throw new Error("A reason is required to override the missing-measurement block.");

  return { allowed: true, overrideReason: reason };
}
