import { describe, expect, it, vi } from "vitest";
import { addFollowUpNote, completeTask, createTask, reopenTask } from "@/lib/enquiries/follow-up-service";

describe("addFollowUpNote", () => {
  it("adds a note when the Enquiry exists", async () => {
    const repository = {
      getEnquirySummary: vi.fn().mockResolvedValue({ id: "enq-1" }),
      addNote: vi.fn().mockResolvedValue({ id: "note-1" }),
      createTask: vi.fn(),
      getTask: vi.fn(),
      setTaskStatus: vi.fn(),
    };

    const result = await addFollowUpNote(
      {
        organizationId: "org-1",
        enquiryId: "enq-1",
        note: "Called, will follow up next week.",
        occurredOn: "2026-08-05",
        nextFollowUpDate: "2026-08-12",
        createdByStaffId: "staff-1",
      },
      repository,
    );

    expect(result).toEqual({ id: "note-1" });
    expect(repository.addNote).toHaveBeenCalled();
  });

  it("rejects an empty note without touching the repository", async () => {
    const repository = {
      getEnquirySummary: vi.fn(),
      addNote: vi.fn(),
      createTask: vi.fn(),
      getTask: vi.fn(),
      setTaskStatus: vi.fn(),
    };

    await expect(
      addFollowUpNote(
        {
          organizationId: "org-1",
          enquiryId: "enq-1",
          note: "   ",
          occurredOn: "2026-08-05",
          nextFollowUpDate: null,
          createdByStaffId: "staff-1",
        },
        repository,
      ),
    ).rejects.toThrow("Note is required.");
    expect(repository.getEnquirySummary).not.toHaveBeenCalled();
  });

  it("rejects a note for an Enquiry that does not exist", async () => {
    const repository = {
      getEnquirySummary: vi.fn().mockResolvedValue(null),
      addNote: vi.fn(),
      createTask: vi.fn(),
      getTask: vi.fn(),
      setTaskStatus: vi.fn(),
    };

    await expect(
      addFollowUpNote(
        {
          organizationId: "org-1",
          enquiryId: "missing",
          note: "Note",
          occurredOn: "2026-08-05",
          nextFollowUpDate: null,
          createdByStaffId: "staff-1",
        },
        repository,
      ),
    ).rejects.toThrow("Enquiry was not found.");
    expect(repository.addNote).not.toHaveBeenCalled();
  });
});

describe("createTask", () => {
  it("requires a title, due date, and assignee", async () => {
    const repository = {
      getEnquirySummary: vi.fn().mockResolvedValue({ id: "enq-1" }),
      addNote: vi.fn(),
      createTask: vi.fn(),
      getTask: vi.fn(),
      setTaskStatus: vi.fn(),
    };

    await expect(
      createTask(
        {
          organizationId: "org-1",
          enquiryId: "enq-1",
          title: "",
          dueDate: "2026-08-10",
          assignedToStaffId: "staff-1",
          note: "",
          createdByStaffId: "staff-1",
        },
        repository,
      ),
    ).rejects.toThrow("Task title is required.");
  });

  it("creates the task once validated", async () => {
    const repository = {
      getEnquirySummary: vi.fn().mockResolvedValue({ id: "enq-1" }),
      addNote: vi.fn(),
      createTask: vi.fn().mockResolvedValue({ id: "task-1" }),
      getTask: vi.fn(),
      setTaskStatus: vi.fn(),
    };

    const result = await createTask(
      {
        organizationId: "org-1",
        enquiryId: "enq-1",
        title: "Send moodboard",
        dueDate: "2026-08-10",
        assignedToStaffId: "staff-1",
        note: "",
        createdByStaffId: "staff-1",
      },
      repository,
    );

    expect(result).toEqual({ id: "task-1" });
  });
});

describe("completeTask / reopenTask", () => {
  it("marks a task done with a version bump", async () => {
    const repository = {
      getEnquirySummary: vi.fn(),
      addNote: vi.fn(),
      createTask: vi.fn(),
      getTask: vi.fn().mockResolvedValue({ id: "task-1", version: 1, status: "open" as const }),
      setTaskStatus: vi.fn().mockResolvedValue(undefined),
    };

    const result = await completeTask({ organizationId: "org-1", taskId: "task-1", expectedVersion: 1 }, repository);

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.setTaskStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done", expectedVersion: 1, nextVersion: 2 }),
    );
  });

  it("rejects completing an already-changed task", async () => {
    const repository = {
      getEnquirySummary: vi.fn(),
      addNote: vi.fn(),
      createTask: vi.fn(),
      getTask: vi.fn().mockResolvedValue({ id: "task-1", version: 3, status: "open" as const }),
      setTaskStatus: vi.fn(),
    };

    await expect(
      completeTask({ organizationId: "org-1", taskId: "task-1", expectedVersion: 1 }, repository),
    ).rejects.toThrow("This Task changed. Reload and try again.");
  });

  it("reopens a completed task", async () => {
    const repository = {
      getEnquirySummary: vi.fn(),
      addNote: vi.fn(),
      createTask: vi.fn(),
      getTask: vi.fn().mockResolvedValue({ id: "task-1", version: 2, status: "done" as const }),
      setTaskStatus: vi.fn().mockResolvedValue(undefined),
    };

    const result = await reopenTask({ organizationId: "org-1", taskId: "task-1", expectedVersion: 2 }, repository);

    expect(result).toEqual({ ok: true, nextVersion: 3 });
    expect(repository.setTaskStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open" }),
    );
  });
});
