import { describe, expect, it, vi } from "vitest";
import { createAccessoryItem, updateAccessoryItem } from "@/lib/accessories/service";
import { createAccessoryStatus, setAccessoryStatusCompleted } from "@/lib/accessory-statuses/service";
import { createAccessoryType } from "@/lib/accessory-types/service";

const assistant = { role: "admin_assistant" as const };
const superAdmin = { role: "super_admin" as const };

function itemRepository(overrides: Record<string, unknown> = {}) {
  return {
    orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
    lookBelongsToOrder: vi.fn().mockResolvedValue(true),
    typeIsSelectable: vi.fn().mockResolvedValue(true),
    statusIsSelectable: vi.fn().mockResolvedValue(true),
    staffIsActiveMember: vi.fn().mockResolvedValue(true),
    getDefaultStatusId: vi.fn().mockResolvedValue("status-1"),
    createAccessoryItem: vi.fn().mockResolvedValue({ id: "acc-1" }),
    getAccessoryItem: vi
      .fn()
      .mockResolvedValue({ id: "acc-1", orderId: "order-1", version: 1, archivedAt: null }),
    updateAccessoryItem: vi.fn().mockResolvedValue(undefined),
    setArchivedState: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const createInput = {
  organizationId: "org-1",
  orderId: "order-1",
  lookId: null,
  accessoryTypeId: "type-1",
  customLabel: "  Black oxfords  ",
  accessoryStatusId: null,
  assignedToStaffId: "staff-1",
  supplier: "  Lekki Leather Goods  ",
  budgetMinor: 125_000,
  purchaseDate: "2026-08-25",
  notes: "  size 44  ",
};

describe("createAccessoryItem", () => {
  it("lets an Admin Assistant source an Accessory and trims free text", async () => {
    const repo = itemRepository();

    await createAccessoryItem({ actor: assistant, ...createInput }, repo);

    expect(repo.createAccessoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        customLabel: "Black oxfords",
        assignedToStaffId: "staff-1",
        supplier: "Lekki Leather Goods",
        budgetMinor: 125_000,
        purchaseDate: "2026-08-25",
        notes: "size 44",
        accessoryStatusId: "status-1",
      }),
    );
  });

  it("rejects an assignee who is not an active member of the organization", async () => {
    const repo = itemRepository({ staffIsActiveMember: vi.fn().mockResolvedValue(false) });

    await expect(createAccessoryItem({ actor: assistant, ...createInput }, repo)).rejects.toThrow(
      "Assigned staff member is unavailable",
    );
    expect(repo.createAccessoryItem).not.toHaveBeenCalled();
  });

  it("rejects negative budgets", async () => {
    const repo = itemRepository();

    await expect(
      createAccessoryItem({ actor: assistant, ...createInput, budgetMinor: -1 }, repo),
    ).rejects.toThrow("Accessory budget cannot be negative");
    expect(repo.createAccessoryItem).not.toHaveBeenCalled();
  });

  it.each(["25/08/2026", "2026-02-30"])("rejects invalid purchase date %s", async (purchaseDate) => {
    const repo = itemRepository();

    await expect(
      createAccessoryItem({ actor: assistant, ...createInput, purchaseDate }, repo),
    ).rejects.toThrow("Purchase date must use YYYY-MM-DD");
    expect(repo.createAccessoryItem).not.toHaveBeenCalled();
  });

  it("defaults to the first live status rather than requiring the caller to pick one", async () => {
    const repo = itemRepository({ getDefaultStatusId: vi.fn().mockResolvedValue("status-not-started") });

    await createAccessoryItem({ actor: assistant, ...createInput }, repo);

    expect(repo.createAccessoryItem).toHaveBeenCalledWith(
      expect.objectContaining({ accessoryStatusId: "status-not-started" }),
    );
  });

  it("explains itself when no statuses are configured", async () => {
    const repo = itemRepository({ getDefaultStatusId: vi.fn().mockResolvedValue(null) });

    await expect(createAccessoryItem({ actor: assistant, ...createInput }, repo)).rejects.toThrow(
      "No accessory statuses are configured",
    );
  });

  it("rejects a Look belonging to a different Order", async () => {
    const repo = itemRepository({ lookBelongsToOrder: vi.fn().mockResolvedValue(false) });

    await expect(
      createAccessoryItem({ actor: assistant, ...createInput, lookId: "look-9" }, repo),
    ).rejects.toThrow("Look was not found on this Order");
  });

  it("rejects an archived type or status", async () => {
    await expect(
      createAccessoryItem({ actor: assistant, ...createInput }, itemRepository({ typeIsSelectable: vi.fn().mockResolvedValue(false) })),
    ).rejects.toThrow("accessory type is unavailable");

    await expect(
      createAccessoryItem(
        { actor: assistant, ...createInput },
        itemRepository({ statusIsSelectable: vi.fn().mockResolvedValue(false) }),
      ),
    ).rejects.toThrow("accessory status is unavailable");
  });

  it("stores an empty label as null rather than an empty string", async () => {
    const repo = itemRepository();

    await createAccessoryItem({ actor: assistant, ...createInput, customLabel: "   " }, repo);

    expect(repo.createAccessoryItem).toHaveBeenCalledWith(expect.objectContaining({ customLabel: null }));
  });
});

describe("updateAccessoryItem", () => {
  const updateInput = {
    organizationId: "org-1",
    accessoryItemId: "acc-1",
    orderId: "order-1",
    lookId: null,
    accessoryTypeId: "type-1",
    customLabel: null,
    accessoryStatusId: "status-2",
    assignedToStaffId: "staff-2",
    supplier: "Mainland Accessories",
    budgetMinor: 98_500,
    purchaseDate: "2026-08-26",
    notes: "",
    expectedVersion: 1,
  };

  it("moves the Accessory to a new status", async () => {
    const repo = itemRepository();

    await updateAccessoryItem({ actor: assistant, ...updateInput }, repo);

    expect(repo.updateAccessoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        accessoryStatusId: "status-2",
        assignedToStaffId: "staff-2",
        supplier: "Mainland Accessories",
        budgetMinor: 98_500,
        purchaseDate: "2026-08-26",
        nextVersion: 2,
      }),
    );
  });

  it("refuses to edit an archived Accessory", async () => {
    const repo = itemRepository({
      getAccessoryItem: vi
        .fn()
        .mockResolvedValue({ id: "acc-1", orderId: "order-1", version: 1, archivedAt: new Date() }),
    });

    await expect(updateAccessoryItem({ actor: assistant, ...updateInput }, repo)).rejects.toThrow(
      "Restore it first",
    );
  });
});

function statusRepository(overrides: Record<string, unknown> = {}) {
  return {
    createAccessoryStatus: vi.fn().mockResolvedValue({ id: "status-1" }),
    getAccessoryStatus: vi.fn().mockResolvedValue({ id: "status-1", version: 1, isCompleted: true }),
    countOtherLiveCompletedStatuses: vi.fn().mockResolvedValue(1),
    setArchivedState: vi.fn().mockResolvedValue(undefined),
    setCompletedSemantics: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("accessory configurable lists", () => {
  it("reserves type and status management for Super Admin", async () => {
    await expect(
      createAccessoryType(
        { actor: assistant, organizationId: "org-1", name: "Belts", sortOrder: 0 },
        { createAccessoryType: vi.fn(), getAccessoryType: vi.fn(), setArchivedState: vi.fn() },
      ),
    ).rejects.toThrow("Super Admin");

    await expect(
      createAccessoryStatus(
        { actor: assistant, organizationId: "org-1", name: "Ordered", sortOrder: 0, isCompleted: false },
        statusRepository(),
      ),
    ).rejects.toThrow("Super Admin");
  });

  it("refuses to un-mark the last delivered status", async () => {
    // Without a delivered status nothing would ever count as outstanding, so the Order warning
    // would silently stop firing.
    const repo = statusRepository({ countOtherLiveCompletedStatuses: vi.fn().mockResolvedValue(0) });

    await expect(
      setAccessoryStatusCompleted(
        { actor: superAdmin, organizationId: "org-1", statusId: "status-1", isCompleted: false, expectedVersion: 1 },
        repo,
      ),
    ).rejects.toThrow("At least one accessory status");
    expect(repo.setCompletedSemantics).not.toHaveBeenCalled();
  });

  it("allows un-marking when another delivered status remains", async () => {
    const repo = statusRepository({ countOtherLiveCompletedStatuses: vi.fn().mockResolvedValue(1) });

    await setAccessoryStatusCompleted(
      { actor: superAdmin, organizationId: "org-1", statusId: "status-1", isCompleted: false, expectedVersion: 1 },
      repo,
    );

    expect(repo.setCompletedSemantics).toHaveBeenCalled();
  });
});
