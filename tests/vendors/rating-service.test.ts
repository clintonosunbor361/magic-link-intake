import { describe, expect, it, vi } from "vitest";
import { rateVendorOnOrder, reviseVendorRating } from "@/lib/vendors/rating-service";

const actor = { role: "admin_assistant" as const, staffId: "staff-1" };
const scores = { quality: 4, timeliness: 3, communication: 5 };

function repository(overrides: Record<string, unknown> = {}) {
  return {
    orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
    vendorIsAvailable: vi.fn().mockResolvedValue(true),
    vendorWorkedOnOrder: vi.fn().mockResolvedValue(true),
    getRating: vi.fn().mockResolvedValue(null),
    createRating: vi.fn().mockResolvedValue({ id: "rating-1" }),
    updateRating: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("rateVendorOnOrder", () => {
  it("lets an Admin Assistant rate a Vendor who worked on the Order", async () => {
    const repo = repository();

    const result = await rateVendorOnOrder(
      { actor, organizationId: "org-1", orderId: "order-1", vendorId: "vendor-1", scores },
      repo,
    );

    expect(result).toEqual({ id: "rating-1" });
    expect(repo.createRating).toHaveBeenCalledWith(expect.objectContaining({ scores, actorStaffId: "staff-1" }));
  });

  it("refuses a Vendor with no assignment on the Order", async () => {
    const repo = repository({ vendorWorkedOnOrder: vi.fn().mockResolvedValue(false) });

    await expect(
      rateVendorOnOrder({ actor, organizationId: "org-1", orderId: "order-1", vendorId: "vendor-2", scores }, repo),
    ).rejects.toThrow("no assignment on this Order");
    expect(repo.createRating).not.toHaveBeenCalled();
  });

  it("enforces one rating per Order and Vendor", async () => {
    const repo = repository({
      getRating: vi.fn().mockResolvedValue({ id: "rating-1", version: 1, ...scores }),
    });

    await expect(
      rateVendorOnOrder({ actor, organizationId: "org-1", orderId: "order-1", vendorId: "vendor-1", scores }, repo),
    ).rejects.toThrow("already rated");
  });

  it("rejects an out-of-range score before any lookup", async () => {
    const repo = repository();

    await expect(
      rateVendorOnOrder(
        { actor, organizationId: "org-1", orderId: "order-1", vendorId: "vendor-1", scores: { ...scores, quality: 6 } },
        repo,
      ),
    ).rejects.toThrow("whole number from 1 to 5");
    expect(repo.orderBelongsToOrganization).not.toHaveBeenCalled();
  });

  it("rejects an Order from another organization", async () => {
    const repo = repository({ orderBelongsToOrganization: vi.fn().mockResolvedValue(false) });

    await expect(
      rateVendorOnOrder({ actor, organizationId: "org-1", orderId: "order-other", vendorId: "vendor-1", scores }, repo),
    ).rejects.toThrow("Order was not found.");
  });
});

describe("reviseVendorRating", () => {
  it("appends a revision with explicit previous and new scores", async () => {
    const repo = repository({
      getRating: vi.fn().mockResolvedValue({ id: "rating-1", version: 1, ...scores }),
    });

    const result = await reviseVendorRating(
      {
        actor,
        organizationId: "org-1",
        orderId: "order-1",
        vendorId: "vendor-1",
        scores: { quality: 4, timeliness: 5, communication: 5 },
        expectedVersion: 1,
      },
      repo,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repo.updateRating).toHaveBeenCalledWith(
      expect.objectContaining({
        previous: scores,
        next: { quality: 4, timeliness: 5, communication: 5 },
        actorStaffId: "staff-1",
      }),
    );
  });

  it("does not manufacture a revision when nothing changed", async () => {
    const repo = repository({
      getRating: vi.fn().mockResolvedValue({ id: "rating-1", version: 3, ...scores }),
    });

    const result = await reviseVendorRating(
      { actor, organizationId: "org-1", orderId: "order-1", vendorId: "vendor-1", scores, expectedVersion: 3 },
      repo,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
    expect(repo.updateRating).not.toHaveBeenCalled();
  });

  it("rejects revising a rating that does not exist", async () => {
    const repo = repository();

    await expect(
      reviseVendorRating(
        { actor, organizationId: "org-1", orderId: "order-1", vendorId: "vendor-1", scores, expectedVersion: 1 },
        repo,
      ),
    ).rejects.toThrow("not been rated");
  });

  it("rejects a stale version", async () => {
    const repo = repository({
      getRating: vi.fn().mockResolvedValue({ id: "rating-1", version: 8, ...scores }),
    });

    await expect(
      reviseVendorRating(
        {
          actor,
          organizationId: "org-1",
          orderId: "order-1",
          vendorId: "vendor-1",
          scores: { ...scores, quality: 2 },
          expectedVersion: 1,
        },
        repo,
      ),
    ).rejects.toThrow("Reload and try again");
  });
});
