import type { StaffRole } from "@/lib/domain/access-control";
import {
  type BriefBlocker,
  computeBriefBlocker,
  resolveExportPermission,
  type VendorBriefSources,
} from "@/lib/vendor-briefs/document";

// The export is a server event, not a client one: hitting the route is what produces the PDF, so
// the blocker check, the override reason, the export metadata and the audit entry are all written
// in the same call that streams the bytes. Nothing here can record an export that did not happen,
// and no export can happen without a record.

export type BriefExportRepository = {
  recordExport(input: {
    organizationId: string;
    assignmentId: string;
    actorStaffId: string;
    exportedAt: Date;
    overrideReason: string | null;
    missingMeasurementLabels: string[];
  }): Promise<void>;
};

export type BriefExportDecision = {
  blocker: BriefBlocker | null;
  overrideReason: string | null;
};

/**
 * Decides whether this export may proceed. Kept separate from the recording step so the preview
 * screen can ask the same question without side effects.
 */
export function decideBriefExport(input: {
  sources: VendorBriefSources;
  role: StaffRole;
  overrideReason: string | null;
}): BriefExportDecision {
  const blocker = computeBriefBlocker(input.sources);
  const permission = resolveExportPermission({
    blocker,
    role: input.role,
    overrideReason: input.overrideReason,
  });

  return { blocker, overrideReason: permission.overrideReason };
}

/**
 * Records that a brief left the building. Phase 1 stores neither the PDF nor a snapshot — only
 * "exported yes/no" (derived from the timestamp), when, by whom, and the override reason if the
 * measurement block was bypassed.
 */
export async function recordBriefExport(
  input: {
    organizationId: string;
    assignmentId: string;
    actor: { staffId: string };
    decision: BriefExportDecision;
    exportedAt?: Date;
  },
  repository: BriefExportRepository,
) {
  await repository.recordExport({
    organizationId: input.organizationId,
    assignmentId: input.assignmentId,
    actorStaffId: input.actor.staffId,
    exportedAt: input.exportedAt ?? new Date(),
    overrideReason: input.decision.overrideReason,
    missingMeasurementLabels: input.decision.blocker?.missingLabels ?? [],
  });
}

export function describeExportForAudit(decision: BriefExportDecision): string {
  if (!decision.overrideReason) return "Exported a Vendor Brief PDF.";

  return `Exported a Vendor Brief PDF, overriding missing required measurements (${decision.blocker?.missingLabels.join(", ")}). Reason: ${decision.overrideReason}`;
}
