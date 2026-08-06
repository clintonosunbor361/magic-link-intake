import { describe, expect, it, vi } from "vitest";
import { archiveConsultationNoteSource, createConsultationNoteSource, restoreConsultationNoteSource } from "@/lib/consultation-note-sources/service";

describe("createConsultationNoteSource", () => {
  it("allows a Super Admin to create a Source", async () => {
    const repository = {
      createConsultationNoteSource: vi.fn().mockResolvedValue({ id: "source-new" }),
      getConsultationNoteSource: vi.fn(),
      setArchivedState: vi.fn(),
    };

    const result = await createConsultationNoteSource(
      { actor: { role: "super_admin" }, organizationId: "org-1", name: "Phone call", sortOrder: 0 },
      repository,
    );

    expect(result).toEqual({ id: "source-new" });
    expect(repository.createConsultationNoteSource).toHaveBeenCalledWith({
      organizationId: "org-1",
      name: "Phone call",
      sortOrder: 0,
    });
  });

  it("rejects an Admin Assistant without touching the repository", async () => {
    const repository = {
      createConsultationNoteSource: vi.fn(),
      getConsultationNoteSource: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createConsultationNoteSource(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", name: "Phone call", sortOrder: 0 },
        repository,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repository.createConsultationNoteSource).not.toHaveBeenCalled();
  });

  it("rejects a blank name", async () => {
    const repository = {
      createConsultationNoteSource: vi.fn(),
      getConsultationNoteSource: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createConsultationNoteSource(
        { actor: { role: "super_admin" }, organizationId: "org-1", name: "   ", sortOrder: 0 },
        repository,
      ),
    ).rejects.toThrow("Source name is required.");
  });
});

describe("archiveConsultationNoteSource / restoreConsultationNoteSource", () => {
  it("archives a Source with a version bump", async () => {
    const repository = {
      createConsultationNoteSource: vi.fn(),
      getConsultationNoteSource: vi.fn().mockResolvedValue({ id: "source-1", version: 1 }),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await archiveConsultationNoteSource(
      { actor: { role: "super_admin" }, organizationId: "org-1", sourceId: "source-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(
      expect.objectContaining({ archived: true, expectedVersion: 1, nextVersion: 2 }),
    );
  });

  it("rejects an Admin Assistant archiving a Source", async () => {
    const repository = {
      createConsultationNoteSource: vi.fn(),
      getConsultationNoteSource: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      archiveConsultationNoteSource(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", sourceId: "source-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repository.getConsultationNoteSource).not.toHaveBeenCalled();
  });

  it("rejects a stale version", async () => {
    const repository = {
      createConsultationNoteSource: vi.fn(),
      getConsultationNoteSource: vi.fn().mockResolvedValue({ id: "source-1", version: 3 }),
      setArchivedState: vi.fn(),
    };

    await expect(
      archiveConsultationNoteSource(
        { actor: { role: "super_admin" }, organizationId: "org-1", sourceId: "source-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("This Source changed. Reload and try again.");
    expect(repository.setArchivedState).not.toHaveBeenCalled();
  });

  it("restores an archived Source", async () => {
    const repository = {
      createConsultationNoteSource: vi.fn(),
      getConsultationNoteSource: vi.fn().mockResolvedValue({ id: "source-1", version: 2 }),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await restoreConsultationNoteSource(
      { actor: { role: "super_admin" }, organizationId: "org-1", sourceId: "source-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
  });
});
