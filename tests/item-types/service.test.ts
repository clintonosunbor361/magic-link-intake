import { describe, expect, it, vi } from "vitest";
import { archiveItemType, createItemType, restoreItemType } from "@/lib/item-types/service";

describe("createItemType", () => {
  it("allows a Super Admin to create an Item Type", async () => {
    const repository = {
      createItemType: vi.fn().mockResolvedValue({ id: "type-new" }),
      getItemType: vi.fn(),
      setArchivedState: vi.fn(),
    };

    const result = await createItemType(
      { actor: { role: "super_admin" }, organizationId: "org-1", name: "Suit", sortOrder: 0 },
      repository,
    );

    expect(result).toEqual({ id: "type-new" });
    expect(repository.createItemType).toHaveBeenCalledWith({
      organizationId: "org-1",
      name: "Suit",
      sortOrder: 0,
    });
  });

  it("rejects an Admin Assistant without touching the repository", async () => {
    const repository = {
      createItemType: vi.fn(),
      getItemType: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createItemType(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", name: "Suit", sortOrder: 0 },
        repository,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repository.createItemType).not.toHaveBeenCalled();
  });

  it("rejects a blank name", async () => {
    const repository = {
      createItemType: vi.fn(),
      getItemType: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createItemType(
        { actor: { role: "super_admin" }, organizationId: "org-1", name: "   ", sortOrder: 0 },
        repository,
      ),
    ).rejects.toThrow("Item type name is required.");
  });
});

describe("archiveItemType / restoreItemType", () => {
  it("archives an Item Type with a version bump", async () => {
    const repository = {
      createItemType: vi.fn(),
      getItemType: vi.fn().mockResolvedValue({ id: "type-1", version: 1 }),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await archiveItemType(
      { actor: { role: "super_admin" }, organizationId: "org-1", itemTypeId: "type-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(
      expect.objectContaining({ archived: true, expectedVersion: 1, nextVersion: 2 }),
    );
  });

  it("rejects an Admin Assistant archiving an Item Type", async () => {
    const repository = {
      createItemType: vi.fn(),
      getItemType: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      archiveItemType(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", itemTypeId: "type-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repository.getItemType).not.toHaveBeenCalled();
  });

  it("rejects a stale version", async () => {
    const repository = {
      createItemType: vi.fn(),
      getItemType: vi.fn().mockResolvedValue({ id: "type-1", version: 3 }),
      setArchivedState: vi.fn(),
    };

    await expect(
      archiveItemType(
        { actor: { role: "super_admin" }, organizationId: "org-1", itemTypeId: "type-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("This Item Type changed. Reload and try again.");
    expect(repository.setArchivedState).not.toHaveBeenCalled();
  });

  it("restores an archived Item Type", async () => {
    const repository = {
      createItemType: vi.fn(),
      getItemType: vi.fn().mockResolvedValue({ id: "type-1", version: 2 }),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await restoreItemType(
      { actor: { role: "super_admin" }, organizationId: "org-1", itemTypeId: "type-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
  });
});
