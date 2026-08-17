import { describe, expect, it, vi } from "vitest";
import { archiveClient, restoreClient, updateClientIdentity } from "@/lib/clients/service";

const validFields = {
  fullName: "Bukola Adewale",
  primaryPhone: "08055556666",
  whatsappPhone: "08055556666",
  email: "bukola@example.com",
};

describe("updateClientIdentity", () => {
  it("updates identity fields with a version bump", async () => {
    const repository = {
      getClientLifecycle: vi.fn().mockResolvedValue({ id: "client-1", version: 1, archivedAt: null }),
      findIdentityConflict: vi.fn().mockResolvedValue(null),
      updateClientIdentity: vi.fn().mockResolvedValue(undefined),
      setArchivedState: vi.fn(),
    };

    const result = await updateClientIdentity(
      { organizationId: "org-1", clientId: "client-1", expectedVersion: 1, fields: validFields },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.updateClientIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ ...validFields, expectedVersion: 1, nextVersion: 2 }),
    );
  });

  it("rejects a missing full name without touching the repository", async () => {
    const repository = {
      getClientLifecycle: vi.fn(),
      findIdentityConflict: vi.fn(),
      updateClientIdentity: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      updateClientIdentity(
        {
          organizationId: "org-1",
          clientId: "client-1",
          expectedVersion: 1,
          fields: { ...validFields, fullName: "  " },
        },
        repository,
      ),
    ).rejects.toThrow("Full name is required.");
    expect(repository.getClientLifecycle).not.toHaveBeenCalled();
  });

  it("rejects a phone number already used by another Client", async () => {
    const repository = {
      getClientLifecycle: vi.fn(),
      findIdentityConflict: vi.fn().mockResolvedValue({
        id: "client-2",
        fullName: "Teni Adesina",
        primaryPhone: "08012345678",
        email: "teni@example.com",
        reason: "phone" as const,
      }),
      updateClientIdentity: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      updateClientIdentity(
        { organizationId: "org-1", clientId: "client-1", expectedVersion: 1, fields: validFields },
        repository,
      ),
    ).rejects.toThrow("Another Client already uses this phone number");
    expect(repository.getClientLifecycle).not.toHaveBeenCalled();
    expect(repository.updateClientIdentity).not.toHaveBeenCalled();
  });

  it("rejects an email address already used by another Client", async () => {
    const repository = {
      getClientLifecycle: vi.fn(),
      findIdentityConflict: vi.fn().mockResolvedValue({
        id: "client-2",
        fullName: "Teni Adesina",
        primaryPhone: "08012345678",
        email: "teni@example.com",
        reason: "email" as const,
      }),
      updateClientIdentity: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      updateClientIdentity(
        { organizationId: "org-1", clientId: "client-1", expectedVersion: 1, fields: validFields },
        repository,
      ),
    ).rejects.toThrow("Another Client already uses this email address");
    expect(repository.getClientLifecycle).not.toHaveBeenCalled();
    expect(repository.updateClientIdentity).not.toHaveBeenCalled();
  });

  it("rejects a stale version", async () => {
    const repository = {
      getClientLifecycle: vi.fn().mockResolvedValue({ id: "client-1", version: 3, archivedAt: null }),
      findIdentityConflict: vi.fn().mockResolvedValue(null),
      updateClientIdentity: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      updateClientIdentity(
        { organizationId: "org-1", clientId: "client-1", expectedVersion: 1, fields: validFields },
        repository,
      ),
    ).rejects.toThrow("This Client changed. Reload and try again.");
    expect(repository.updateClientIdentity).not.toHaveBeenCalled();
  });
});

describe("archiveClient / restoreClient", () => {
  it("allows a Super Admin to archive a Client", async () => {
    const repository = {
      getClientLifecycle: vi.fn().mockResolvedValue({ id: "client-1", version: 1, archivedAt: null }),
      findIdentityConflict: vi.fn(),
      updateClientIdentity: vi.fn(),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await archiveClient(
      { actor: { organizationId: "org-1", role: "super_admin" }, clientId: "client-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(expect.objectContaining({ archived: true }));
  });

  it("rejects an Admin Assistant archiving a Client", async () => {
    const repository = {
      getClientLifecycle: vi.fn(),
      findIdentityConflict: vi.fn(),
      updateClientIdentity: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      archiveClient(
        { actor: { organizationId: "org-1", role: "admin_assistant" }, clientId: "client-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("You cannot archive this Client.");
    expect(repository.getClientLifecycle).not.toHaveBeenCalled();
  });

  it("allows a Super Admin to restore a Client", async () => {
    const repository = {
      getClientLifecycle: vi.fn().mockResolvedValue({ id: "client-1", version: 2, archivedAt: new Date() }),
      findIdentityConflict: vi.fn(),
      updateClientIdentity: vi.fn(),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await restoreClient(
      { actor: { organizationId: "org-1", role: "super_admin" }, clientId: "client-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
  });

  it("rejects an Admin Assistant restoring a Client", async () => {
    const repository = {
      getClientLifecycle: vi.fn(),
      findIdentityConflict: vi.fn(),
      updateClientIdentity: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      restoreClient(
        { actor: { organizationId: "org-1", role: "admin_assistant" }, clientId: "client-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("You cannot restore this Client.");
  });
});
