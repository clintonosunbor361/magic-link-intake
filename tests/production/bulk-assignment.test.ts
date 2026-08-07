import { describe, expect, it } from "vitest";
import { describeBulkAssignment, planBulkAssignment } from "@/lib/production/bulk-assignment";

describe("planBulkAssignment", () => {
  it("assigns only the unassigned Items", () => {
    const plan = planBulkAssignment([
      { itemId: "item-1", label: "Suit", currentVendorName: null },
      { itemId: "item-2", label: "Shirt", currentVendorName: "Tunde Fabrics" },
      { itemId: "item-3", label: "Trouser", currentVendorName: null },
    ]);

    expect(plan.assignItemIds).toEqual(["item-1", "item-3"]);
    expect(plan.skipped).toEqual([{ itemId: "item-2", label: "Shirt", currentVendorName: "Tunde Fabrics" }]);
  });

  it("never replaces an existing assignment, because replacing archives its production history", () => {
    const plan = planBulkAssignment([
      { itemId: "item-1", label: "Suit", currentVendorName: "Tunde Fabrics" },
      { itemId: "item-2", label: "Cap", currentVendorName: "Bola Tailors" },
    ]);

    expect(plan.assignItemIds).toEqual([]);
    expect(plan.skipped).toHaveLength(2);
  });

  it("handles an empty selection", () => {
    expect(planBulkAssignment([])).toEqual({ assignItemIds: [], skipped: [] });
  });
});

describe("describeBulkAssignment", () => {
  it("reports a clean run without mentioning skips", () => {
    const plan = planBulkAssignment([
      { itemId: "item-1", label: "Suit", currentVendorName: null },
      { itemId: "item-2", label: "Cap", currentVendorName: null },
    ]);

    expect(describeBulkAssignment(plan)).toBe("2 Items assigned.");
  });

  it("names the blocking Vendor when every skip shares one", () => {
    const plan = planBulkAssignment([
      { itemId: "item-1", label: "Suit", currentVendorName: null },
      { itemId: "item-2", label: "Shirt", currentVendorName: "Tunde Fabrics" },
    ]);

    expect(describeBulkAssignment(plan)).toBe(
      "1 Item assigned, 1 skipped — already assigned to Tunde Fabrics. Reassign from the Item's assignment drawer.",
    );
  });

  it("generalises when the skips span several Vendors", () => {
    const plan = planBulkAssignment([
      { itemId: "item-1", label: "Shirt", currentVendorName: "Tunde Fabrics" },
      { itemId: "item-2", label: "Cap", currentVendorName: "Bola Tailors" },
    ]);

    expect(describeBulkAssignment(plan)).toBe(
      "0 Items assigned, 2 skipped — already assigned to another Vendor. Reassign from the Item's assignment drawer.",
    );
  });

  it("never reports a skip silently", () => {
    const plan = planBulkAssignment([{ itemId: "item-1", label: "Shirt", currentVendorName: "Tunde Fabrics" }]);
    expect(describeBulkAssignment(plan)).toContain("skipped");
  });
});
