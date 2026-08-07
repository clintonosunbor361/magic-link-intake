// Look-level bulk assignment exists for speed on a fresh Look. It deliberately cannot replace an
// existing assignment: replacing one archives its status history and production notes and resets
// production to the default status, and that is a consequential act that belongs to the
// single-item drawer where you can see exactly what you are changing. Bulk therefore assigns the
// unassigned and reports the rest, rather than asking for a confirmation that people click through.

export type BulkAssignmentCandidate = {
  itemId: string;
  label: string;
  currentVendorName: string | null;
};

export type BulkAssignmentPlan = {
  assignItemIds: string[];
  skipped: { itemId: string; label: string; currentVendorName: string }[];
};

export function planBulkAssignment(candidates: readonly BulkAssignmentCandidate[]): BulkAssignmentPlan {
  const assignItemIds: string[] = [];
  const skipped: BulkAssignmentPlan["skipped"] = [];

  for (const candidate of candidates) {
    if (candidate.currentVendorName === null) {
      assignItemIds.push(candidate.itemId);
    } else {
      skipped.push({
        itemId: candidate.itemId,
        label: candidate.label,
        currentVendorName: candidate.currentVendorName,
      });
    }
  }

  return { assignItemIds, skipped };
}

/**
 * The message shown after a bulk assignment. Skips are never silent — a bulk action that quietly
 * did less than it appeared to is the failure mode this whole design is avoiding.
 */
export function describeBulkAssignment(plan: BulkAssignmentPlan): string {
  const assigned = `${plan.assignItemIds.length} ${plural(plan.assignItemIds.length, "Item")} assigned`;
  if (!plan.skipped.length) return `${assigned}.`;

  const vendors = [...new Set(plan.skipped.map((entry) => entry.currentVendorName))];
  const attribution =
    vendors.length === 1 ? `already assigned to ${vendors[0]}` : "already assigned to another Vendor";

  return `${assigned}, ${plan.skipped.length} skipped — ${attribution}. Reassign from the Item's assignment drawer.`;
}

function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}
