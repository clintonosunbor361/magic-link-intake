import { describe, expect, it, vi } from "vitest";
import { archiveItem, createItem, restoreItem, updateItem } from "@/lib/orders/item-service";

const validFields = { itemTypeId: "type-1", customLabel: null, quantity: 1 };

describe("createItem", () => {
  it("creates an Item", async () => {
    const repository = {
      lookBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createItem: vi.fn().mockResolvedValue({ id: "item-new" }),
      getItemLifecycle: vi.fn(),
      updateItem: vi.fn(),
      setArchivedState: vi.fn(),
    };

    const result = await createItem({ organizationId: "org-1", lookId: "look-1", fields: validFields }, repository);

    expect(result).toEqual({ id: "item-new" });
    expect(repository.createItem).toHaveBeenCalledWith({ organizationId: "org-1", lookId: "look-1", ...validFields });
  });

  it("rejects a missing item type", async () => {
    const repository = {
      lookBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createItem: vi.fn(),
      getItemLifecycle: vi.fn(),
      updateItem: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createItem(
        { organizationId: "org-1", lookId: "look-1", fields: { ...validFields, itemTypeId: "" } },
        repository,
      ),
    ).rejects.toThrow("Item type is required.");
  });

  it("rejects a non-positive quantity", async () => {
    const repository = {
      lookBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createItem: vi.fn(),
      getItemLifecycle: vi.fn(),
      updateItem: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createItem({ organizationId: "org-1", lookId: "look-1", fields: { ...validFields, quantity: 0 } }, repository),
    ).rejects.toThrow("Quantity must be at least 1.");
  });

  it("rejects creating an Item under a Look outside the caller's organization", async () => {
    const repository = {
      lookBelongsToOrganization: vi.fn().mockResolvedValue(false),
      createItem: vi.fn(),
      getItemLifecycle: vi.fn(),
      updateItem: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createItem({ organizationId: "org-1", lookId: "look-from-other-org", fields: validFields }, repository),
    ).rejects.toThrow("Look was not found.");
    expect(repository.createItem).not.toHaveBeenCalled();
  });
});

describe("updateItem", () => {
  it("rejects a stale version", async () => {
    const repository = {
      lookBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createItem: vi.fn(),
      getItemLifecycle: vi.fn().mockResolvedValue({ id: "item-1", version: 4, archivedAt: null }),
      updateItem: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      updateItem({ organizationId: "org-1", itemId: "item-1", expectedVersion: 1, fields: validFields }, repository),
    ).rejects.toThrow("This Item changed. Reload and try again.");
  });
});

describe("archiveItem / restoreItem", () => {
  it("allows a Super Admin to archive an Item", async () => {
    const repository = {
      lookBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createItem: vi.fn(),
      getItemLifecycle: vi.fn().mockResolvedValue({ id: "item-1", version: 1, archivedAt: null }),
      updateItem: vi.fn(),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await archiveItem(
      { actor: { organizationId: "org-1", role: "super_admin" }, itemId: "item-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
  });

  it("rejects an Admin Assistant archiving an Item", async () => {
    const repository = {
      lookBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createItem: vi.fn(),
      getItemLifecycle: vi.fn(),
      updateItem: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      archiveItem(
        { actor: { organizationId: "org-1", role: "admin_assistant" }, itemId: "item-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("You cannot archive this Item.");
  });

  it("restores an archived Item", async () => {
    const repository = {
      lookBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createItem: vi.fn(),
      getItemLifecycle: vi.fn().mockResolvedValue({ id: "item-1", version: 2, archivedAt: new Date() }),
      updateItem: vi.fn(),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await restoreItem(
      { actor: { organizationId: "org-1", role: "super_admin" }, itemId: "item-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
  });
});
