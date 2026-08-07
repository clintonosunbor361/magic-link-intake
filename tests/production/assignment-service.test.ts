import { describe, expect, it, vi } from "vitest";
import {
  assignVendorToItem,
  bulkAssignVendorToLook,
  reassignVendor,
  updateAssignmentTerms,
} from "@/lib/production/assignment-service";

const actor = { role: "admin_assistant" as const, staffId: "staff-1" };

function repository(overrides: Record<string, unknown> = {}) {
  return {
    itemBelongsToOrganization: vi.fn().mockResolvedValue(true),
    vendorIsAvailable: vi.fn().mockResolvedValue(true),
    getDefaultProductionStatusId: vi.fn().mockResolvedValue("status-not-started"),
    getLiveAssignmentForItem: vi.fn().mockResolvedValue(null),
    getAssignment: vi.fn().mockResolvedValue({ id: "assignment-1", version: 1, itemId: "item-1" }),
    listLookItemsForAssignment: vi.fn().mockResolvedValue([]),
    createAssignments: vi.fn().mockResolvedValue({ ids: ["assignment-new"] }),
    updateAssignmentTerms: vi.fn().mockResolvedValue(undefined),
    replaceAssignment: vi.fn().mockResolvedValue({ id: "assignment-replacement" }),
    ...overrides,
  };
}

describe("assignVendorToItem", () => {
  it("assigns an unassigned Item at the default production status", async () => {
    const repo = repository();

    const result = await assignVendorToItem(
      {
        actor,
        organizationId: "org-1",
        itemId: "item-1",
        vendorId: "vendor-1",
        deadline: "2026-09-01",
        agreedVendorCostMinor: 150_000_00,
      },
      repo,
    );

    expect(result).toEqual({ id: "assignment-new" });
    expect(repo.createAssignments).toHaveBeenCalledWith(
      expect.objectContaining({
        itemIds: ["item-1"],
        vendorId: "vendor-1",
        productionStatusId: "status-not-started",
        agreedVendorCostMinor: 150_000_00,
        actorStaffId: "staff-1",
      }),
    );
  });

  it("refuses to silently replace an existing assignment", async () => {
    const repo = repository({
      getLiveAssignmentForItem: vi.fn().mockResolvedValue({ id: "assignment-1", version: 1, itemId: "item-1" }),
    });

    await expect(
      assignVendorToItem(
        { actor, organizationId: "org-1", itemId: "item-1", vendorId: "vendor-2", deadline: "2026-09-01", agreedVendorCostMinor: null },
        repo,
      ),
    ).rejects.toThrow("already has a Vendor");
    expect(repo.createAssignments).not.toHaveBeenCalled();
  });

  it("rejects an Item from another organization", async () => {
    const repo = repository({ itemBelongsToOrganization: vi.fn().mockResolvedValue(false) });

    await expect(
      assignVendorToItem(
        { actor, organizationId: "org-1", itemId: "item-other", vendorId: "vendor-1", deadline: "2026-09-01", agreedVendorCostMinor: null },
        repo,
      ),
    ).rejects.toThrow("Item was not found.");
  });

  it("rejects a Vendor from another organization", async () => {
    const repo = repository({ vendorIsAvailable: vi.fn().mockResolvedValue(false) });

    await expect(
      assignVendorToItem(
        { actor, organizationId: "org-1", itemId: "item-1", vendorId: "vendor-other", deadline: "2026-09-01", agreedVendorCostMinor: null },
        repo,
      ),
    ).rejects.toThrow("Vendor was not found.");
  });

  it("rejects a malformed deadline before touching the repository", async () => {
    const repo = repository();

    await expect(
      assignVendorToItem(
        { actor, organizationId: "org-1", itemId: "item-1", vendorId: "vendor-1", deadline: "01/09/2026", agreedVendorCostMinor: null },
        repo,
      ),
    ).rejects.toThrow("YYYY-MM-DD");
    expect(repo.createAssignments).not.toHaveBeenCalled();
  });

  it("rejects a fractional or negative agreed cost", async () => {
    const repo = repository();
    const base = { actor, organizationId: "org-1", itemId: "item-1", vendorId: "vendor-1", deadline: "2026-09-01" };

    await expect(assignVendorToItem({ ...base, agreedVendorCostMinor: 1500.5 }, repo)).rejects.toThrow("minor units");
    await expect(assignVendorToItem({ ...base, agreedVendorCostMinor: -1 }, repo)).rejects.toThrow("minor units");
  });

  it("fails clearly when no production statuses are configured", async () => {
    const repo = repository({ getDefaultProductionStatusId: vi.fn().mockResolvedValue(null) });

    await expect(
      assignVendorToItem(
        { actor, organizationId: "org-1", itemId: "item-1", vendorId: "vendor-1", deadline: "2026-09-01", agreedVendorCostMinor: null },
        repo,
      ),
    ).rejects.toThrow("No production statuses are configured");
  });
});

describe("bulkAssignVendorToLook", () => {
  it("assigns the unassigned Items and reports the skips", async () => {
    const repo = repository({
      listLookItemsForAssignment: vi.fn().mockResolvedValue([
        { itemId: "item-1", label: "Agbada", currentVendorName: null },
        { itemId: "item-2", label: "Cap", currentVendorName: "Tunde Fabrics" },
        { itemId: "item-3", label: "Trouser", currentVendorName: null },
      ]),
      createAssignments: vi.fn().mockResolvedValue({ ids: ["a-1", "a-3"] }),
    });

    const result = await bulkAssignVendorToLook(
      { actor, organizationId: "org-1", lookId: "look-1", vendorId: "vendor-1", deadline: "2026-09-01", agreedVendorCostMinor: null },
      repo,
    );

    expect(result.assignedCount).toBe(2);
    expect(result.message).toContain("2 Items assigned");
    expect(result.message).toContain("1 skipped");
    expect(repo.createAssignments).toHaveBeenCalledWith(expect.objectContaining({ itemIds: ["item-1", "item-3"] }));
  });

  it("writes nothing when every Item is already assigned", async () => {
    const repo = repository({
      listLookItemsForAssignment: vi.fn().mockResolvedValue([
        { itemId: "item-1", label: "Agbada", currentVendorName: "Tunde Fabrics" },
      ]),
    });

    const result = await bulkAssignVendorToLook(
      { actor, organizationId: "org-1", lookId: "look-1", vendorId: "vendor-2", deadline: "2026-09-01", agreedVendorCostMinor: null },
      repo,
    );

    expect(result.assignedCount).toBe(0);
    expect(repo.createAssignments).not.toHaveBeenCalled();
  });

  it("rejects a Look with no Items", async () => {
    const repo = repository({ listLookItemsForAssignment: vi.fn().mockResolvedValue([]) });

    await expect(
      bulkAssignVendorToLook(
        { actor, organizationId: "org-1", lookId: "look-1", vendorId: "vendor-1", deadline: "2026-09-01", agreedVendorCostMinor: null },
        repo,
      ),
    ).rejects.toThrow("no Items to assign");
  });
});

describe("updateAssignmentTerms", () => {
  it("updates deadline and cost with a version bump", async () => {
    const repo = repository();

    const result = await updateAssignmentTerms(
      {
        actor,
        organizationId: "org-1",
        assignmentId: "assignment-1",
        expectedVersion: 1,
        deadline: "2026-09-15",
        agreedVendorCostMinor: 90_000_00,
      },
      repo,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repo.updateAssignmentTerms).toHaveBeenCalledWith(
      expect.objectContaining({ deadline: "2026-09-15", expectedVersion: 1, nextVersion: 2 }),
    );
  });

  it("rejects a stale version", async () => {
    const repo = repository({
      getAssignment: vi.fn().mockResolvedValue({ id: "assignment-1", version: 4, itemId: "item-1" }),
    });

    await expect(
      updateAssignmentTerms(
        { actor, organizationId: "org-1", assignmentId: "assignment-1", expectedVersion: 1, deadline: "2026-09-15", agreedVendorCostMinor: null },
        repo,
      ),
    ).rejects.toThrow("Reload and try again");
    expect(repo.updateAssignmentTerms).not.toHaveBeenCalled();
  });
});

describe("reassignVendor", () => {
  it("archives the old assignment and creates a fresh one for the new Vendor", async () => {
    const repo = repository();

    const result = await reassignVendor(
      {
        actor,
        organizationId: "org-1",
        assignmentId: "assignment-1",
        vendorId: "vendor-2",
        expectedVersion: 1,
        reason: "Original Vendor withdrew",
        deadline: "2026-09-01",
        agreedVendorCostMinor: null,
      },
      repo,
    );

    expect(result).toEqual({ id: "assignment-replacement" });
    expect(repo.replaceAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: "assignment-1",
        itemId: "item-1",
        vendorId: "vendor-2",
        // The replacement starts at the default status with no carried history.
        productionStatusId: "status-not-started",
        reason: "Original Vendor withdrew",
      }),
    );
  });

  it("requires a reason", async () => {
    const repo = repository();

    await expect(
      reassignVendor(
        {
          actor,
          organizationId: "org-1",
          assignmentId: "assignment-1",
          vendorId: "vendor-2",
          expectedVersion: 1,
          reason: "   ",
          deadline: "2026-09-01",
          agreedVendorCostMinor: null,
        },
        repo,
      ),
    ).rejects.toThrow("A reason is required");
    expect(repo.replaceAssignment).not.toHaveBeenCalled();
  });

  it("rejects a stale version rather than archiving the wrong assignment", async () => {
    const repo = repository({
      getAssignment: vi.fn().mockResolvedValue({ id: "assignment-1", version: 7, itemId: "item-1" }),
    });

    await expect(
      reassignVendor(
        {
          actor,
          organizationId: "org-1",
          assignmentId: "assignment-1",
          vendorId: "vendor-2",
          expectedVersion: 1,
          reason: "Vendor withdrew",
          deadline: "2026-09-01",
          agreedVendorCostMinor: null,
        },
        repo,
      ),
    ).rejects.toThrow("Reload and try again");
    expect(repo.replaceAssignment).not.toHaveBeenCalled();
  });
});
