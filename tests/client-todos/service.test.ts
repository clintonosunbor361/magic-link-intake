import { describe, expect, it, vi } from "vitest";
import { completeClientTask, createClientTask, reopenClientTask } from "@/lib/client-todos/service";

function repository(overrides: Record<string, unknown> = {}) {
  return {
    getClientSummary: vi.fn().mockResolvedValue({ id: "client-1" }),
    createTask: vi.fn().mockResolvedValue({ id: "task-1" }),
    getTask: vi.fn().mockResolvedValue({ id: "task-1", version: 1, status: "open" as const }),
    setTaskStatus: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("createClientTask", () => {
  it("requires a title, due date, and assignee", async () => {
    const repo = repository();

    await expect(
      createClientTask(
        {
          organizationId: "org-1",
          clientId: "client-1",
          title: "",
          dueDate: "2026-08-20",
          assignedToStaffId: "staff-1",
          note: "",
          createdByStaffId: "staff-1",
        },
        repo,
      ),
    ).rejects.toThrow("To-do title is required.");
    expect(repo.createTask).not.toHaveBeenCalled();
  });

  it("creates a to-do with an optional note once validated", async () => {
    const repo = repository();

    const result = await createClientTask(
      {
        organizationId: "org-1",
        clientId: "client-1",
        title: "Confirm budget by Friday",
        dueDate: "2026-08-20",
        assignedToStaffId: "staff-1",
        note: "Ask about reception suit range.",
        createdByStaffId: "staff-1",
      },
      repo,
    );

    expect(result).toEqual({ id: "task-1" });
    expect(repo.createTask).toHaveBeenCalledWith(expect.objectContaining({ note: "Ask about reception suit range." }));
  });

  it("rejects a to-do for a missing client", async () => {
    const repo = repository({ getClientSummary: vi.fn().mockResolvedValue(null) });

    await expect(
      createClientTask(
        {
          organizationId: "org-1",
          clientId: "missing",
          title: "Call client",
          dueDate: "2026-08-20",
          assignedToStaffId: "staff-1",
          note: "",
          createdByStaffId: "staff-1",
        },
        repo,
      ),
    ).rejects.toThrow("Client was not found.");
    expect(repo.createTask).not.toHaveBeenCalled();
  });
});

describe("completeClientTask / reopenClientTask", () => {
  it("marks an open to-do done with a version bump", async () => {
    const repo = repository();

    const result = await completeClientTask({ organizationId: "org-1", taskId: "task-1", expectedVersion: 1 }, repo);

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repo.setTaskStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done", expectedVersion: 1, nextVersion: 2 }),
    );
  });

  it("rejects completing an already-changed to-do", async () => {
    const repo = repository({ getTask: vi.fn().mockResolvedValue({ id: "task-1", version: 3, status: "open" }) });

    await expect(
      completeClientTask({ organizationId: "org-1", taskId: "task-1", expectedVersion: 1 }, repo),
    ).rejects.toThrow("This To-do changed. Reload and try again.");
  });

  it("reopens a completed to-do", async () => {
    const repo = repository({ getTask: vi.fn().mockResolvedValue({ id: "task-1", version: 2, status: "done" }) });

    const result = await reopenClientTask({ organizationId: "org-1", taskId: "task-1", expectedVersion: 2 }, repo);

    expect(result).toEqual({ ok: true, nextVersion: 3 });
    expect(repo.setTaskStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "open" }));
  });
});
