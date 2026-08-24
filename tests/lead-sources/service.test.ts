import { describe, expect, it, vi } from "vitest";
import { archiveLeadSource, createLeadSource, restoreLeadSource } from "@/lib/lead-sources/service";

describe("createLeadSource", () => {
  it("allows a Super Admin to create a Lead Source", async () => {
    const repository = {
      createLeadSource: vi.fn().mockResolvedValue({ id: "source-new" }),
      getLeadSource: vi.fn(),
      setArchivedState: vi.fn(),
    };

    const result = await createLeadSource(
      { actor: { role: "super_admin" }, organizationId: "org-1", name: "Instagram", sortOrder: 0 },
      repository,
    );

    expect(result).toEqual({ id: "source-new" });
    expect(repository.createLeadSource).toHaveBeenCalledWith({
      organizationId: "org-1",
      name: "Instagram",
      sortOrder: 0,
    });
  });

  it("rejects an Admin Assistant without touching the repository", async () => {
    const repository = {
      createLeadSource: vi.fn(),
      getLeadSource: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createLeadSource(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", name: "Instagram", sortOrder: 0 },
        repository,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repository.createLeadSource).not.toHaveBeenCalled();
  });

  it("rejects a blank name", async () => {
    const repository = {
      createLeadSource: vi.fn(),
      getLeadSource: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createLeadSource(
        { actor: { role: "super_admin" }, organizationId: "org-1", name: "   ", sortOrder: 0 },
        repository,
      ),
    ).rejects.toThrow("Lead source name is required.");
  });
});

describe("archiveLeadSource / restoreLeadSource", () => {
  it("archives a Lead Source with a version bump", async () => {
    const repository = {
      createLeadSource: vi.fn(),
      getLeadSource: vi.fn().mockResolvedValue({ id: "source-1", version: 1 }),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await archiveLeadSource(
      { actor: { role: "super_admin" }, organizationId: "org-1", leadSourceId: "source-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(
      expect.objectContaining({ archived: true, expectedVersion: 1, nextVersion: 2 }),
    );
  });

  it("rejects an Admin Assistant archiving a Lead Source", async () => {
    const repository = {
      createLeadSource: vi.fn(),
      getLeadSource: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      archiveLeadSource(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", leadSourceId: "source-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repository.getLeadSource).not.toHaveBeenCalled();
  });

  it("rejects a stale version", async () => {
    const repository = {
      createLeadSource: vi.fn(),
      getLeadSource: vi.fn().mockResolvedValue({ id: "source-1", version: 3 }),
      setArchivedState: vi.fn(),
    };

    await expect(
      archiveLeadSource(
        { actor: { role: "super_admin" }, organizationId: "org-1", leadSourceId: "source-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("This Lead Source changed. Reload and try again.");
    expect(repository.setArchivedState).not.toHaveBeenCalled();
  });

  it("restores an archived Lead Source", async () => {
    const repository = {
      createLeadSource: vi.fn(),
      getLeadSource: vi.fn().mockResolvedValue({ id: "source-1", version: 2 }),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await restoreLeadSource(
      { actor: { role: "super_admin" }, organizationId: "org-1", leadSourceId: "source-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
  });
});
