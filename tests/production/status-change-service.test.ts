import { describe, expect, it, vi } from "vitest";
import { addProductionNote, changeProductionStatus } from "@/lib/production/status-change-service";

const actor = { role: "admin_assistant" as const, staffId: "staff-1" };

function statusRepository(overrides: Record<string, unknown> = {}) {
  return {
    getAssignmentStatus: vi
      .fn()
      .mockResolvedValue({ id: "assignment-1", version: 2, productionStatusId: "status-not-started" }),
    statusIsSelectable: vi.fn().mockResolvedValue(true),
    applyStatusChange: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("changeProductionStatus", () => {
  it("records previous and new status, actor, and note in one write", async () => {
    const repo = statusRepository();

    const result = await changeProductionStatus(
      {
        actor,
        organizationId: "org-1",
        assignmentId: "assignment-1",
        newStatusId: "status-in-production",
        note: "  Fabric arrived  ",
        expectedVersion: 2,
      },
      repo,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
    expect(repo.applyStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatusId: "status-not-started",
        newStatusId: "status-in-production",
        note: "Fabric arrived",
        actorStaffId: "staff-1",
      }),
    );
  });

  it("stores a blank note as null rather than an empty history entry", async () => {
    const repo = statusRepository();

    await changeProductionStatus(
      { actor, organizationId: "org-1", assignmentId: "assignment-1", newStatusId: "status-in-production", note: "   ", expectedVersion: 2 },
      repo,
    );

    expect(repo.applyStatusChange).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });

  it("allows an Admin Assistant to select a status", async () => {
    const repo = statusRepository();

    await expect(
      changeProductionStatus(
        { actor, organizationId: "org-1", assignmentId: "assignment-1", newStatusId: "status-ready", note: null, expectedVersion: 2 },
        repo,
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it("rejects an archived or cross-organization status", async () => {
    const repo = statusRepository({ statusIsSelectable: vi.fn().mockResolvedValue(false) });

    await expect(
      changeProductionStatus(
        { actor, organizationId: "org-1", assignmentId: "assignment-1", newStatusId: "status-archived", note: null, expectedVersion: 2 },
        repo,
      ),
    ).rejects.toThrow("unavailable");
    expect(repo.applyStatusChange).not.toHaveBeenCalled();
  });

  it("rejects a no-op change so history stays meaningful", async () => {
    const repo = statusRepository();

    await expect(
      changeProductionStatus(
        { actor, organizationId: "org-1", assignmentId: "assignment-1", newStatusId: "status-not-started", note: null, expectedVersion: 2 },
        repo,
      ),
    ).rejects.toThrow("already at that status");
    expect(repo.applyStatusChange).not.toHaveBeenCalled();
  });

  it("rejects a stale version", async () => {
    const repo = statusRepository({
      getAssignmentStatus: vi
        .fn()
        .mockResolvedValue({ id: "assignment-1", version: 9, productionStatusId: "status-not-started" }),
    });

    await expect(
      changeProductionStatus(
        { actor, organizationId: "org-1", assignmentId: "assignment-1", newStatusId: "status-in-production", note: null, expectedVersion: 2 },
        repo,
      ),
    ).rejects.toThrow("Reload and try again");
  });
});

describe("addProductionNote", () => {
  it("records an internal note against the assignment", async () => {
    const repo = {
      assignmentBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createProductionNote: vi.fn().mockResolvedValue({ id: "note-1" }),
    };

    const result = await addProductionNote(
      { actor, organizationId: "org-1", assignmentId: "assignment-1", note: "  Zip delayed  " },
      repo,
    );

    expect(result).toEqual({ id: "note-1" });
    expect(repo.createProductionNote).toHaveBeenCalledWith(
      expect.objectContaining({ note: "Zip delayed", actorStaffId: "staff-1" }),
    );
  });

  it("rejects a blank note", async () => {
    const repo = {
      assignmentBelongsToOrganization: vi.fn().mockResolvedValue(true),
      createProductionNote: vi.fn(),
    };

    await expect(
      addProductionNote({ actor, organizationId: "org-1", assignmentId: "assignment-1", note: "   " }, repo),
    ).rejects.toThrow("A note is required.");
    expect(repo.createProductionNote).not.toHaveBeenCalled();
  });

  it("rejects an assignment from another organization", async () => {
    const repo = {
      assignmentBelongsToOrganization: vi.fn().mockResolvedValue(false),
      createProductionNote: vi.fn(),
    };

    await expect(
      addProductionNote({ actor, organizationId: "org-1", assignmentId: "assignment-other", note: "Zip delayed" }, repo),
    ).rejects.toThrow("Vendor assignment was not found.");
  });
});
