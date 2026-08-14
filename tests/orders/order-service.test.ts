import { describe, expect, it, vi } from "vitest";
import { archiveOrder, createActiveOrder, restoreOrder, updateOrderDetails } from "@/lib/orders/order-service";

const validFields = {
  title: "Tayo Wedding",
  eventType: "Wedding",
  finalAgreedPriceMinor: 50_000_00,
  ffDiscount: false,
  ffDiscountAmountMinor: null,
};

describe("createActiveOrder", () => {
  it("creates an Order and its first Look as one repository operation", async () => {
    const repository = { clientBelongsToOrganization: vi.fn().mockResolvedValue(true), createOrderWithFirstLook: vi.fn().mockResolvedValue({ orderId: "order-1", lookId: "look-1" }) };
    const result = await createActiveOrder({ organizationId: "org-1", actorStaffId: "staff-1", fields: { ...validFields, clientId: "client-1", primaryOwnerStaffId: "staff-1", firstLook: { name: "Reception", lookDate: null, notes: "" } } }, repository);
    expect(result).toEqual({ orderId: "order-1", lookId: "look-1" });
    expect(repository.createOrderWithFirstLook).toHaveBeenCalledOnce();
  });

  it("rejects a Client outside the organization", async () => {
    const repository = { clientBelongsToOrganization: vi.fn().mockResolvedValue(false), createOrderWithFirstLook: vi.fn() };
    await expect(createActiveOrder({ organizationId: "org-1", actorStaffId: "staff-1", fields: { ...validFields, clientId: "client-x", primaryOwnerStaffId: "staff-1", firstLook: { name: "Reception", lookDate: null, notes: "" } } }, repository)).rejects.toThrow("Client was not found.");
  });
});

describe("updateOrderDetails", () => {
  it("updates Order fields with a version bump", async () => {
    const repository = {
      getOrderLifecycle: vi.fn().mockResolvedValue({ id: "order-1", version: 1, archivedAt: null }),
      updateOrderDetails: vi.fn().mockResolvedValue(undefined),
      setArchivedState: vi.fn(),
    };

    const result = await updateOrderDetails(
      { organizationId: "org-1", orderId: "order-1", expectedVersion: 1, fields: validFields },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.updateOrderDetails).toHaveBeenCalledWith(
      expect.objectContaining({ ...validFields, expectedVersion: 1, nextVersion: 2 }),
    );
  });

  it("rejects a non-positive final agreed price", async () => {
    const repository = {
      getOrderLifecycle: vi.fn().mockResolvedValue({ id: "order-1", version: 1, archivedAt: null }),
      updateOrderDetails: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      updateOrderDetails(
        {
          organizationId: "org-1",
          orderId: "order-1",
          expectedVersion: 1,
          fields: { ...validFields, finalAgreedPriceMinor: 0 },
        },
        repository,
      ),
    ).rejects.toThrow("Final agreed price must be greater than zero.");
  });

  it("rejects a stale version", async () => {
    const repository = {
      getOrderLifecycle: vi.fn().mockResolvedValue({ id: "order-1", version: 5, archivedAt: null }),
      updateOrderDetails: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      updateOrderDetails(
        { organizationId: "org-1", orderId: "order-1", expectedVersion: 1, fields: validFields },
        repository,
      ),
    ).rejects.toThrow("This Order changed. Reload and try again.");
    expect(repository.updateOrderDetails).not.toHaveBeenCalled();
  });

  it("never derives the final agreed price from the FF discount amount", async () => {
    const repository = {
      getOrderLifecycle: vi.fn().mockResolvedValue({ id: "order-1", version: 1, archivedAt: null }),
      updateOrderDetails: vi.fn().mockResolvedValue(undefined),
      setArchivedState: vi.fn(),
    };

    const ffFields = { ...validFields, ffDiscount: true, ffDiscountAmountMinor: 10_000_00 };

    const result = await updateOrderDetails(
      { organizationId: "org-1", orderId: "order-1", expectedVersion: 1, fields: ffFields },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.updateOrderDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        finalAgreedPriceMinor: ffFields.finalAgreedPriceMinor,
        ffDiscount: true,
        ffDiscountAmountMinor: ffFields.ffDiscountAmountMinor,
      }),
    );
  });
});

describe("archiveOrder / restoreOrder", () => {
  it("allows a Super Admin to archive an Order", async () => {
    const repository = {
      getOrderLifecycle: vi.fn().mockResolvedValue({ id: "order-1", version: 1, archivedAt: null }),
      updateOrderDetails: vi.fn(),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await archiveOrder(
      { actor: { organizationId: "org-1", role: "super_admin" }, orderId: "order-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
  });

  it("rejects an Admin Assistant archiving an Order", async () => {
    const repository = {
      getOrderLifecycle: vi.fn(),
      updateOrderDetails: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      archiveOrder(
        { actor: { organizationId: "org-1", role: "admin_assistant" }, orderId: "order-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("You cannot archive this Order.");
  });

  it("allows a Super Admin to restore an Order", async () => {
    const repository = {
      getOrderLifecycle: vi.fn().mockResolvedValue({ id: "order-1", version: 2, archivedAt: new Date() }),
      updateOrderDetails: vi.fn(),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await restoreOrder(
      { actor: { organizationId: "org-1", role: "super_admin" }, orderId: "order-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
  });
});
