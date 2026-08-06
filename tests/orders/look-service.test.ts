import { describe, expect, it, vi } from "vitest";
import { archiveLook, createLook, restoreLook, updateLook } from "@/lib/orders/look-service";

const validFields = { name: "Traditional Wedding", lookDate: null, notes: "" };

describe("createLook", () => {
  it("creates a Look", async () => {
    const repository = {
      orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createLook: vi.fn().mockResolvedValue({ id: "look-new" }),
      getLookLifecycle: vi.fn(),
      updateLook: vi.fn(),
      archiveLookIfNotLast: vi.fn(),
      restoreLook: vi.fn(),
    };

    const result = await createLook({ organizationId: "org-1", orderId: "order-1", fields: validFields }, repository);

    expect(result).toEqual({ id: "look-new" });
    expect(repository.createLook).toHaveBeenCalledWith({ organizationId: "org-1", orderId: "order-1", ...validFields });
  });

  it("rejects a blank Look name", async () => {
    const repository = {
      orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createLook: vi.fn(),
      getLookLifecycle: vi.fn(),
      updateLook: vi.fn(),
      archiveLookIfNotLast: vi.fn(),
      restoreLook: vi.fn(),
    };

    await expect(
      createLook({ organizationId: "org-1", orderId: "order-1", fields: { ...validFields, name: "  " } }, repository),
    ).rejects.toThrow("Look name is required.");
    expect(repository.createLook).not.toHaveBeenCalled();
  });

  it("rejects creating a Look under an Order outside the caller's organization", async () => {
    const repository = {
      orderBelongsToOrganization: vi.fn().mockResolvedValue(false),
      createLook: vi.fn(),
      getLookLifecycle: vi.fn(),
      updateLook: vi.fn(),
      archiveLookIfNotLast: vi.fn(),
      restoreLook: vi.fn(),
    };

    await expect(
      createLook({ organizationId: "org-1", orderId: "order-from-other-org", fields: validFields }, repository),
    ).rejects.toThrow("Order was not found.");
    expect(repository.createLook).not.toHaveBeenCalled();
  });
});

describe("updateLook", () => {
  it("rejects a stale version", async () => {
    const repository = {
      orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createLook: vi.fn(),
      getLookLifecycle: vi.fn().mockResolvedValue({ id: "look-1", orderId: "order-1", version: 4, archivedAt: null }),
      updateLook: vi.fn(),
      archiveLookIfNotLast: vi.fn(),
      restoreLook: vi.fn(),
    };

    await expect(
      updateLook({ organizationId: "org-1", lookId: "look-1", expectedVersion: 1, fields: validFields }, repository),
    ).rejects.toThrow("This Look changed. Reload and try again.");
  });
});

describe("archiveLook / restoreLook", () => {
  it("delegates to archiveLookIfNotLast with a version bump", async () => {
    const repository = {
      orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createLook: vi.fn(),
      getLookLifecycle: vi.fn().mockResolvedValue({ id: "look-1", orderId: "order-1", version: 1, archivedAt: null }),
      updateLook: vi.fn(),
      archiveLookIfNotLast: vi.fn().mockResolvedValue(undefined),
      restoreLook: vi.fn(),
    };

    const result = await archiveLook(
      { actor: { organizationId: "org-1", role: "super_admin" }, orderId: "order-1", lookId: "look-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.archiveLookIfNotLast).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", lookId: "look-1", expectedVersion: 1, nextVersion: 2 }),
    );
  });

  it("rejects an Admin Assistant archiving a Look", async () => {
    const repository = {
      orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createLook: vi.fn(),
      getLookLifecycle: vi.fn(),
      updateLook: vi.fn(),
      archiveLookIfNotLast: vi.fn(),
      restoreLook: vi.fn(),
    };

    await expect(
      archiveLook(
        { actor: { organizationId: "org-1", role: "admin_assistant" }, orderId: "order-1", lookId: "look-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("You cannot archive this Look.");
    expect(repository.getLookLifecycle).not.toHaveBeenCalled();
  });

  it("propagates the last-Look invariant error from the repository", async () => {
    const repository = {
      orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createLook: vi.fn(),
      getLookLifecycle: vi.fn().mockResolvedValue({ id: "look-1", orderId: "order-1", version: 1, archivedAt: null }),
      updateLook: vi.fn(),
      archiveLookIfNotLast: vi.fn().mockRejectedValue(new Error("An Order must have at least one Look.")),
      restoreLook: vi.fn(),
    };

    await expect(
      archiveLook(
        { actor: { organizationId: "org-1", role: "super_admin" }, orderId: "order-1", lookId: "look-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("An Order must have at least one Look.");
  });

  it("restores an archived Look", async () => {
    const repository = {
      orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createLook: vi.fn(),
      getLookLifecycle: vi.fn().mockResolvedValue({ id: "look-1", orderId: "order-1", version: 2, archivedAt: new Date() }),
      updateLook: vi.fn(),
      archiveLookIfNotLast: vi.fn(),
      restoreLook: vi.fn().mockResolvedValue(undefined),
    };

    const result = await restoreLook(
      { actor: { organizationId: "org-1", role: "super_admin" }, lookId: "look-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
  });
});
