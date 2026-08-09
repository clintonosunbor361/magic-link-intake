import { describe, expect, it, vi } from "vitest";
import {
  addFittingNote,
  changeFittingStatus,
  rescheduleFittingSession,
  scheduleFittingSession,
} from "@/lib/fittings/service";

const assistant = { role: "admin_assistant" as const, staffId: "staff-1" };
const scheduledAt = new Date("2026-09-05T14:30:00.000Z");

function repository(overrides: Record<string, unknown> = {}) {
  return {
    orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
    lookBelongsToOrder: vi.fn().mockResolvedValue(true),
    createSession: vi.fn().mockResolvedValue({ id: "fit-1" }),
    getSession: vi.fn().mockResolvedValue({
      id: "fit-1",
      orderId: "order-1",
      status: "scheduled",
      scheduledAt,
      version: 1,
      archivedAt: null,
    }),
    rescheduleSession: vi.fn().mockResolvedValue(undefined),
    changeStatus: vi.fn().mockResolvedValue(undefined),
    updateClientSummary: vi.fn().mockResolvedValue(undefined),
    setArchivedState: vi.fn().mockResolvedValue(undefined),
    addNote: vi.fn().mockResolvedValue({ id: "note-1" }),
    ...overrides,
  };
}

describe("scheduleFittingSession", () => {
  const input = {
    organizationId: "org-1",
    orderId: "order-1",
    lookId: null,
    scheduledAt,
    location: "  Lagos studio  ",
  };

  it("schedules an Order-wide Fitting and trims the location", async () => {
    const repo = repository();

    await scheduleFittingSession({ actor: assistant, ...input }, repo);

    expect(repo.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ lookId: null, location: "Lagos studio", actorStaffId: "staff-1" }),
    );
  });

  it("allows repeat Fittings — a second session on the same Order is normal", async () => {
    const repo = repository();

    await scheduleFittingSession({ actor: assistant, ...input }, repo);
    await scheduleFittingSession({ actor: assistant, ...input }, repo);

    expect(repo.createSession).toHaveBeenCalledTimes(2);
  });

  it("rejects a Look that belongs to a different Order", async () => {
    const repo = repository({ lookBelongsToOrder: vi.fn().mockResolvedValue(false) });

    await expect(
      scheduleFittingSession({ actor: assistant, ...input, lookId: "look-9" }, repo),
    ).rejects.toThrow("Look was not found on this Order");
    expect(repo.createSession).not.toHaveBeenCalled();
  });

  it("rejects a missing Order", async () => {
    const repo = repository({ orderBelongsToOrganization: vi.fn().mockResolvedValue(false) });

    await expect(scheduleFittingSession({ actor: assistant, ...input }, repo)).rejects.toThrow(
      "Order was not found",
    );
  });
});

describe("rescheduleFittingSession", () => {
  const input = {
    organizationId: "org-1",
    sessionId: "fit-1",
    scheduledAt: new Date("2026-09-12T10:00:00.000Z"),
    location: "Studio 2",
    note: "Client travelling",
    expectedVersion: 1,
  };

  it("moves the same record and carries the previous date into history", async () => {
    const repo = repository();

    await rescheduleFittingSession({ actor: assistant, ...input }, repo);

    expect(repo.rescheduleSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "fit-1",
        previousScheduledAt: scheduledAt,
        scheduledAt: input.scheduledAt,
        nextVersion: 2,
      }),
    );
    // Rescheduling must not create a second session — that would be a repeat fitting, not a move.
    expect(repo.createSession).not.toHaveBeenCalled();
  });

  it("refuses to move a concluded Fitting", async () => {
    const repo = repository({
      getSession: vi.fn().mockResolvedValue({
        id: "fit-1",
        orderId: "order-1",
        status: "missed",
        scheduledAt,
        version: 1,
        archivedAt: null,
      }),
    });

    await expect(rescheduleFittingSession({ actor: assistant, ...input }, repo)).rejects.toThrow(
      "cannot be rescheduled",
    );
  });

  it("refuses to move an archived Fitting", async () => {
    const repo = repository({
      getSession: vi.fn().mockResolvedValue({
        id: "fit-1",
        orderId: "order-1",
        status: "scheduled",
        scheduledAt,
        version: 1,
        archivedAt: new Date(),
      }),
    });

    await expect(rescheduleFittingSession({ actor: assistant, ...input }, repo)).rejects.toThrow("archived");
  });

  it("rejects a stale version rather than clobbering a concurrent edit", async () => {
    const repo = repository({
      getSession: vi.fn().mockResolvedValue({
        id: "fit-1",
        orderId: "order-1",
        status: "scheduled",
        scheduledAt,
        version: 7,
        archivedAt: null,
      }),
    });

    await expect(rescheduleFittingSession({ actor: assistant, ...input }, repo)).rejects.toThrow(
      "Reload and try again",
    );
  });
});

describe("changeFittingStatus", () => {
  const input = {
    organizationId: "org-1",
    sessionId: "fit-1",
    newStatus: "completed" as const,
    note: null,
    expectedVersion: 1,
  };

  it("records the previous status alongside the new one", async () => {
    const repo = repository();

    await changeFittingStatus({ actor: assistant, ...input }, repo);

    expect(repo.changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ previousStatus: "scheduled", newStatus: "completed", nextVersion: 2 }),
    );
  });

  it("refuses to reopen a concluded Fitting", async () => {
    const repo = repository({
      getSession: vi.fn().mockResolvedValue({
        id: "fit-1",
        orderId: "order-1",
        status: "completed",
        scheduledAt,
        version: 1,
        archivedAt: null,
      }),
    });

    await expect(
      changeFittingStatus({ actor: assistant, ...input, newStatus: "scheduled" }, repo),
    ).rejects.toThrow("repeat Fitting");
  });
});

describe("addFittingNote", () => {
  it("records an internal note against the session", async () => {
    const repo = repository();

    await addFittingNote(
      { actor: assistant, organizationId: "org-1", sessionId: "fit-1", note: "  Sleeves 2cm  " },
      repo,
    );

    expect(repo.addNote).toHaveBeenCalledWith(expect.objectContaining({ note: "Sleeves 2cm" }));
  });

  it("rejects an empty note", async () => {
    const repo = repository();

    await expect(
      addFittingNote({ actor: assistant, organizationId: "org-1", sessionId: "fit-1", note: "   " }, repo),
    ).rejects.toThrow("note is required");
    expect(repo.addNote).not.toHaveBeenCalled();
  });
});
