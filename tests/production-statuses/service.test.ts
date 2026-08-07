import { describe, expect, it, vi } from "vitest";
import {
  archiveProductionStatus,
  createProductionStatus,
  restoreProductionStatus,
  setProductionStatusCompletedSemantics,
} from "@/lib/production-statuses/service";

function repository(overrides: Record<string, unknown> = {}) {
  return {
    createProductionStatus: vi.fn().mockResolvedValue({ id: "status-new" }),
    getProductionStatus: vi.fn().mockResolvedValue({ id: "status-1", version: 1, isCompleted: false }),
    countOtherLiveCompletedStatuses: vi.fn().mockResolvedValue(1),
    setArchivedState: vi.fn().mockResolvedValue(undefined),
    setCompletedSemantics: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("createProductionStatus", () => {
  it("allows a Super Admin to add a status", async () => {
    const repo = repository();

    await createProductionStatus(
      { actor: { role: "super_admin" }, organizationId: "org-1", name: " Ready for Fitting ", sortOrder: 3, isCompleted: false },
      repo,
    );

    expect(repo.createProductionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ready for Fitting", sortOrder: 3, isCompleted: false }),
    );
  });

  it("rejects an Admin Assistant, who may only select statuses", async () => {
    const repo = repository();

    await expect(
      createProductionStatus(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", name: "Delayed", sortOrder: 5, isCompleted: false },
        repo,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repo.createProductionStatus).not.toHaveBeenCalled();
  });

  it("rejects a blank name", async () => {
    const repo = repository();

    await expect(
      createProductionStatus(
        { actor: { role: "super_admin" }, organizationId: "org-1", name: "  ", sortOrder: 0, isCompleted: false },
        repo,
      ),
    ).rejects.toThrow("Status name is required.");
  });
});

describe("archiveProductionStatus", () => {
  it("archives a non-completed status without checking the completed invariant", async () => {
    const repo = repository();

    const result = await archiveProductionStatus(
      { actor: { role: "super_admin" }, organizationId: "org-1", statusId: "status-1", expectedVersion: 1 },
      repo,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repo.countOtherLiveCompletedStatuses).not.toHaveBeenCalled();
  });

  it("archives a completed status while another completed status remains", async () => {
    const repo = repository({
      getProductionStatus: vi.fn().mockResolvedValue({ id: "status-1", version: 1, isCompleted: true }),
      countOtherLiveCompletedStatuses: vi.fn().mockResolvedValue(1),
    });

    await expect(
      archiveProductionStatus(
        { actor: { role: "super_admin" }, organizationId: "org-1", statusId: "status-1", expectedVersion: 1 },
        repo,
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it("refuses to archive the last completed status", async () => {
    const repo = repository({
      getProductionStatus: vi.fn().mockResolvedValue({ id: "status-1", version: 1, isCompleted: true }),
      countOtherLiveCompletedStatuses: vi.fn().mockResolvedValue(0),
    });

    await expect(
      archiveProductionStatus(
        { actor: { role: "super_admin" }, organizationId: "org-1", statusId: "status-1", expectedVersion: 1 },
        repo,
      ),
    ).rejects.toThrow("At least one production status must be marked as completed.");
    expect(repo.setArchivedState).not.toHaveBeenCalled();
  });
});

describe("restoreProductionStatus", () => {
  it("restores an archived status", async () => {
    const repo = repository({
      getProductionStatus: vi.fn().mockResolvedValue({ id: "status-1", version: 2, isCompleted: false }),
    });

    await restoreProductionStatus(
      { actor: { role: "super_admin" }, organizationId: "org-1", statusId: "status-1", expectedVersion: 2 },
      repo,
    );

    expect(repo.setArchivedState).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
  });
});

describe("setProductionStatusCompletedSemantics", () => {
  it("marks a status as completed", async () => {
    const repo = repository();

    await setProductionStatusCompletedSemantics(
      { actor: { role: "super_admin" }, organizationId: "org-1", statusId: "status-1", isCompleted: true, expectedVersion: 1 },
      repo,
    );

    expect(repo.setCompletedSemantics).toHaveBeenCalledWith(expect.objectContaining({ isCompleted: true }));
  });

  it("refuses to clear the flag on the last completed status", async () => {
    const repo = repository({
      getProductionStatus: vi.fn().mockResolvedValue({ id: "status-1", version: 1, isCompleted: true }),
      countOtherLiveCompletedStatuses: vi.fn().mockResolvedValue(0),
    });

    await expect(
      setProductionStatusCompletedSemantics(
        { actor: { role: "super_admin" }, organizationId: "org-1", statusId: "status-1", isCompleted: false, expectedVersion: 1 },
        repo,
      ),
    ).rejects.toThrow("At least one production status must be marked as completed.");
    expect(repo.setCompletedSemantics).not.toHaveBeenCalled();
  });

  it("rejects an Admin Assistant", async () => {
    const repo = repository();

    await expect(
      setProductionStatusCompletedSemantics(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", statusId: "status-1", isCompleted: true, expectedVersion: 1 },
        repo,
      ),
    ).rejects.toThrow("Super Admin access is required.");
  });
});
