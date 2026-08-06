import { describe, expect, it, vi } from "vitest";
import {
  archiveConsultationNote,
  createConsultationNote,
  restoreConsultationNote,
  updateConsultationNoteWithHistory,
} from "@/lib/consultation-notes/service";

const baseRepository = () => ({
  orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
  lookBelongsToOrder: vi.fn().mockResolvedValue(true),
  sourceBelongsToOrganization: vi.fn().mockResolvedValue(true),
  createConsultationNote: vi.fn().mockResolvedValue({ id: "note-new" }),
  getConsultationNoteForEdit: vi.fn(),
  updateConsultationNoteWithHistory: vi.fn().mockResolvedValue(undefined),
  getConsultationNoteLifecycle: vi.fn(),
  setArchivedState: vi.fn(),
});

describe("createConsultationNote", () => {
  it("creates a whole-order-scoped note", async () => {
    const repository = baseRepository();

    const result = await createConsultationNote(
      {
        organizationId: "org-1",
        orderId: "order-1",
        lookId: null,
        createdByStaffId: "staff-1",
        fields: { sourceId: "source-1", body: "Client wants a slimmer fit.", occurredAt: null },
      },
      repository,
    );

    expect(result).toEqual({ id: "note-new" });
    expect(repository.lookBelongsToOrder).not.toHaveBeenCalled();
    expect(repository.createConsultationNote).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", orderId: "order-1", lookId: null, sourceId: "source-1" }),
    );
  });

  it("creates a Look-scoped note", async () => {
    const repository = baseRepository();

    await createConsultationNote(
      {
        organizationId: "org-1",
        orderId: "order-1",
        lookId: "look-1",
        createdByStaffId: "staff-1",
        fields: { sourceId: "source-1", body: "Fabric swatch approved in person.", occurredAt: new Date("2026-01-01T10:00:00Z") },
      },
      repository,
    );

    expect(repository.lookBelongsToOrder).toHaveBeenCalledWith("org-1", "order-1", "look-1");
    expect(repository.createConsultationNote).toHaveBeenCalledWith(expect.objectContaining({ lookId: "look-1" }));
  });

  it("rejects a blank body", async () => {
    const repository = baseRepository();

    await expect(
      createConsultationNote(
        { organizationId: "org-1", orderId: "order-1", lookId: null, createdByStaffId: "staff-1", fields: { sourceId: "source-1", body: "   ", occurredAt: null } },
        repository,
      ),
    ).rejects.toThrow("Note body is required.");
    expect(repository.createConsultationNote).not.toHaveBeenCalled();
  });

  it("rejects an Order outside the caller's organization", async () => {
    const repository = baseRepository();
    repository.orderBelongsToOrganization.mockResolvedValue(false);

    await expect(
      createConsultationNote(
        { organizationId: "org-1", orderId: "order-from-other-org", lookId: null, createdByStaffId: "staff-1", fields: { sourceId: "source-1", body: "Note", occurredAt: null } },
        repository,
      ),
    ).rejects.toThrow("Order was not found.");
    expect(repository.createConsultationNote).not.toHaveBeenCalled();
  });

  it("rejects a Look that doesn't belong to the given Order", async () => {
    const repository = baseRepository();
    repository.lookBelongsToOrder.mockResolvedValue(false);

    await expect(
      createConsultationNote(
        { organizationId: "org-1", orderId: "order-1", lookId: "look-from-other-order", createdByStaffId: "staff-1", fields: { sourceId: "source-1", body: "Note", occurredAt: null } },
        repository,
      ),
    ).rejects.toThrow("Look was not found.");
    expect(repository.createConsultationNote).not.toHaveBeenCalled();
  });

  it("rejects a Source outside the caller's organization", async () => {
    const repository = baseRepository();
    repository.sourceBelongsToOrganization.mockResolvedValue(false);

    await expect(
      createConsultationNote(
        { organizationId: "org-1", orderId: "order-1", lookId: null, createdByStaffId: "staff-1", fields: { sourceId: "source-from-other-org", body: "Note", occurredAt: null } },
        repository,
      ),
    ).rejects.toThrow("Source was not found.");
    expect(repository.createConsultationNote).not.toHaveBeenCalled();
  });
});

describe("updateConsultationNoteWithHistory", () => {
  it("snapshots the creator's content as the prior author on the first edit", async () => {
    const repository = baseRepository();
    repository.getConsultationNoteForEdit.mockResolvedValue({
      id: "note-1",
      version: 1,
      body: "Original body",
      sourceId: "source-1",
      occurredAt: null,
      createdByStaffId: "staff-creator",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      lastEditedByStaffId: null,
      lastEditedAt: null,
    });

    const result = await updateConsultationNoteWithHistory(
      {
        organizationId: "org-1",
        noteId: "note-1",
        expectedVersion: 1,
        editedByStaffId: "staff-editor",
        fields: { sourceId: "source-2", body: "Edited body", occurredAt: null },
      },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.updateConsultationNoteWithHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        nextVersion: 2,
        fields: { sourceId: "source-2", body: "Edited body", occurredAt: null },
        priorSnapshot: expect.objectContaining({
          body: "Original body",
          sourceId: "source-1",
          authorStaffId: "staff-creator",
          authoredAt: new Date("2026-01-01T00:00:00Z"),
        }),
      }),
    );
  });

  it("snapshots the previous editor's content as the prior author on a second edit", async () => {
    const repository = baseRepository();
    repository.getConsultationNoteForEdit.mockResolvedValue({
      id: "note-1",
      version: 2,
      body: "Edited body",
      sourceId: "source-2",
      occurredAt: null,
      createdByStaffId: "staff-creator",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      lastEditedByStaffId: "staff-editor",
      lastEditedAt: new Date("2026-01-02T00:00:00Z"),
    });

    await updateConsultationNoteWithHistory(
      {
        organizationId: "org-1",
        noteId: "note-1",
        expectedVersion: 2,
        editedByStaffId: "staff-second-editor",
        fields: { sourceId: "source-3", body: "Edited again", occurredAt: null },
      },
      repository,
    );

    expect(repository.updateConsultationNoteWithHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        priorSnapshot: expect.objectContaining({
          body: "Edited body",
          sourceId: "source-2",
          authorStaffId: "staff-editor",
          authoredAt: new Date("2026-01-02T00:00:00Z"),
        }),
      }),
    );
  });

  it("rejects a blank body", async () => {
    const repository = baseRepository();

    await expect(
      updateConsultationNoteWithHistory(
        { organizationId: "org-1", noteId: "note-1", expectedVersion: 1, editedByStaffId: "staff-1", fields: { sourceId: "source-1", body: "  ", occurredAt: null } },
        repository,
      ),
    ).rejects.toThrow("Note body is required.");
    expect(repository.getConsultationNoteForEdit).not.toHaveBeenCalled();
  });

  it("rejects a stale version", async () => {
    const repository = baseRepository();
    repository.getConsultationNoteForEdit.mockResolvedValue({
      id: "note-1",
      version: 5,
      body: "Body",
      sourceId: "source-1",
      occurredAt: null,
      createdByStaffId: "staff-1",
      createdAt: new Date(),
      lastEditedByStaffId: null,
      lastEditedAt: null,
    });

    await expect(
      updateConsultationNoteWithHistory(
        { organizationId: "org-1", noteId: "note-1", expectedVersion: 1, editedByStaffId: "staff-1", fields: { sourceId: "source-1", body: "New body", occurredAt: null } },
        repository,
      ),
    ).rejects.toThrow("This Consultation Note changed. Reload and try again.");
    expect(repository.updateConsultationNoteWithHistory).not.toHaveBeenCalled();
  });
});

describe("archiveConsultationNote / restoreConsultationNote", () => {
  it("allows a Super Admin to archive a Consultation Note", async () => {
    const repository = baseRepository();
    repository.getConsultationNoteLifecycle.mockResolvedValue({ id: "note-1", version: 1 });
    repository.setArchivedState.mockResolvedValue(undefined);

    const result = await archiveConsultationNote(
      { actor: { organizationId: "org-1", role: "super_admin" }, noteId: "note-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
  });

  it("rejects an Admin Assistant archiving a Consultation Note", async () => {
    const repository = baseRepository();

    await expect(
      archiveConsultationNote(
        { actor: { organizationId: "org-1", role: "admin_assistant" }, noteId: "note-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("You cannot archive this Consultation Note.");
    expect(repository.getConsultationNoteLifecycle).not.toHaveBeenCalled();
  });

  it("allows a Super Admin to restore a Consultation Note", async () => {
    const repository = baseRepository();
    repository.getConsultationNoteLifecycle.mockResolvedValue({ id: "note-1", version: 2 });
    repository.setArchivedState.mockResolvedValue(undefined);

    const result = await restoreConsultationNote(
      { actor: { organizationId: "org-1", role: "super_admin" }, noteId: "note-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
  });
});
