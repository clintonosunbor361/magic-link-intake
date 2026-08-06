import { describe, expect, it, vi } from "vitest";
import {
  addStyleDirectionFileRevision,
  archiveStyleDirectionFile,
  createStyleDirectionFile,
  MAX_ORIGINAL_UPLOAD_BYTES,
  restoreStyleDirectionFile,
} from "@/lib/style-direction-files/file-service";

const baseRepository = () => ({
  orderBelongsToOrganization: vi.fn().mockResolvedValue(true),
  lookBelongsToOrder: vi.fn().mockResolvedValue(true),
  createFileWithFirstRevision: vi.fn().mockResolvedValue({ fileId: "file-new", revisionId: "revision-new" }),
  getFileForRevision: vi.fn(),
  addRevision: vi.fn().mockResolvedValue({ revisionId: "revision-2" }),
  getFileLifecycle: vi.fn(),
  setArchivedState: vi.fn(),
  insertRevisionReplacedAudit: vi.fn().mockResolvedValue(undefined),
});

const baseStorage = () => ({
  putObject: vi.fn().mockResolvedValue(undefined),
  deleteObject: vi.fn().mockResolvedValue(undefined),
  compressImage: vi.fn().mockResolvedValue({ buffer: Buffer.from("compressed"), mimeType: "image/jpeg", extension: "jpg" }),
});

const validUpload = { buffer: Buffer.from("a valid image"), declaredMimeType: "image/jpeg" };

describe("createStyleDirectionFile", () => {
  it("creates a whole-order-scoped file", async () => {
    const repository = baseRepository();
    const storage = baseStorage();

    const result = await createStyleDirectionFile(
      { organizationId: "org-1", orderId: "order-1", lookId: null, category: "moodboard", requiresClientApproval: false, uploadedByStaffId: "staff-1" },
      validUpload,
      repository,
      storage,
    );

    expect(result).toEqual({ fileId: "file-new", revisionId: "revision-new" });
    expect(storage.putObject).toHaveBeenCalledWith(expect.stringContaining("orgs/org-1/orders/order-1/style-direction/1-"), expect.any(Buffer), "image/jpeg");
    expect(repository.lookBelongsToOrder).not.toHaveBeenCalled();
  });

  it("creates a Look-scoped file", async () => {
    const repository = baseRepository();
    const storage = baseStorage();

    await createStyleDirectionFile(
      { organizationId: "org-1", orderId: "order-1", lookId: "look-1", category: "sketch", requiresClientApproval: true, uploadedByStaffId: "staff-1" },
      validUpload,
      repository,
      storage,
    );

    expect(repository.lookBelongsToOrder).toHaveBeenCalledWith("org-1", "order-1", "look-1");
    expect(repository.createFileWithFirstRevision).toHaveBeenCalledWith(expect.objectContaining({ lookId: "look-1", requiresClientApproval: true }));
  });

  it("rejects an upload over the size cap without touching storage", async () => {
    const repository = baseRepository();
    const storage = baseStorage();
    const oversized = { buffer: Buffer.alloc(MAX_ORIGINAL_UPLOAD_BYTES + 1), declaredMimeType: "image/jpeg" };

    await expect(
      createStyleDirectionFile(
        { organizationId: "org-1", orderId: "order-1", lookId: null, category: "moodboard", requiresClientApproval: false, uploadedByStaffId: "staff-1" },
        oversized,
        repository,
        storage,
      ),
    ).rejects.toThrow("File is too large. The maximum upload size is 15MB.");
    expect(storage.compressImage).not.toHaveBeenCalled();
  });

  it("rejects an unsupported file type", async () => {
    const repository = baseRepository();
    const storage = baseStorage();

    await expect(
      createStyleDirectionFile(
        { organizationId: "org-1", orderId: "order-1", lookId: null, category: "moodboard", requiresClientApproval: false, uploadedByStaffId: "staff-1" },
        { buffer: Buffer.from("pdf bytes"), declaredMimeType: "application/pdf" },
        repository,
        storage,
      ),
    ).rejects.toThrow("Unsupported file type. Upload a JPEG, PNG, WebP, or HEIC image.");
    expect(storage.compressImage).not.toHaveBeenCalled();
  });

  it("rejects an Order outside the caller's organization before touching storage", async () => {
    const repository = baseRepository();
    repository.orderBelongsToOrganization.mockResolvedValue(false);
    const storage = baseStorage();

    await expect(
      createStyleDirectionFile(
        { organizationId: "org-1", orderId: "order-from-other-org", lookId: null, category: "moodboard", requiresClientApproval: false, uploadedByStaffId: "staff-1" },
        validUpload,
        repository,
        storage,
      ),
    ).rejects.toThrow("Order was not found.");
    expect(storage.compressImage).not.toHaveBeenCalled();
  });

  it("rejects a Look that doesn't belong to the given Order", async () => {
    const repository = baseRepository();
    repository.lookBelongsToOrder.mockResolvedValue(false);
    const storage = baseStorage();

    await expect(
      createStyleDirectionFile(
        { organizationId: "org-1", orderId: "order-1", lookId: "look-from-other-order", category: "moodboard", requiresClientApproval: false, uploadedByStaffId: "staff-1" },
        validUpload,
        repository,
        storage,
      ),
    ).rejects.toThrow("Look was not found.");
  });

  it("deletes the uploaded object if the database insert fails", async () => {
    const repository = baseRepository();
    repository.createFileWithFirstRevision.mockRejectedValue(new Error("db exploded"));
    const storage = baseStorage();

    await expect(
      createStyleDirectionFile(
        { organizationId: "org-1", orderId: "order-1", lookId: null, category: "moodboard", requiresClientApproval: false, uploadedByStaffId: "staff-1" },
        validUpload,
        repository,
        storage,
      ),
    ).rejects.toThrow("db exploded");
    expect(storage.deleteObject).toHaveBeenCalledWith(expect.stringContaining("orgs/org-1/orders/order-1/style-direction/1-"));
  });
});

describe("addStyleDirectionFileRevision", () => {
  it("adds a revision, increments the revision number, and resets approvalStatus to pending", async () => {
    const repository = baseRepository();
    repository.getFileForRevision.mockResolvedValue({
      id: "file-1",
      orderId: "order-1",
      version: 1,
      archivedAt: null,
      requiresClientApproval: true,
      currentRevisionNumber: 1,
    });
    const storage = baseStorage();

    const result = await addStyleDirectionFileRevision(
      { organizationId: "org-1", fileId: "file-1", expectedVersion: 1, uploadedByStaffId: "staff-1" },
      validUpload,
      repository,
      storage,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.addRevision).toHaveBeenCalledWith(
      expect.objectContaining({ revisionNumber: 2, resetApprovalToPending: true, nextVersion: 2 }),
    );
    expect(repository.insertRevisionReplacedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: "file-1", revisionId: "revision-2", revisionNumber: 2 }),
    );
  });

  it("does not reset approvalStatus when the file never required client approval", async () => {
    const repository = baseRepository();
    repository.getFileForRevision.mockResolvedValue({
      id: "file-1",
      orderId: "order-1",
      version: 1,
      archivedAt: null,
      requiresClientApproval: false,
      currentRevisionNumber: 1,
    });
    const storage = baseStorage();

    await addStyleDirectionFileRevision(
      { organizationId: "org-1", fileId: "file-1", expectedVersion: 1, uploadedByStaffId: "staff-1" },
      validUpload,
      repository,
      storage,
    );

    expect(repository.addRevision).toHaveBeenCalledWith(expect.objectContaining({ resetApprovalToPending: false }));
  });

  it("rejects revising an archived file", async () => {
    const repository = baseRepository();
    repository.getFileForRevision.mockResolvedValue({
      id: "file-1",
      orderId: "order-1",
      version: 1,
      archivedAt: new Date(),
      requiresClientApproval: false,
      currentRevisionNumber: 1,
    });
    const storage = baseStorage();

    await expect(
      addStyleDirectionFileRevision(
        { organizationId: "org-1", fileId: "file-1", expectedVersion: 1, uploadedByStaffId: "staff-1" },
        validUpload,
        repository,
        storage,
      ),
    ).rejects.toThrow("An archived Style Direction File cannot be revised.");
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("rejects a stale version", async () => {
    const repository = baseRepository();
    repository.getFileForRevision.mockResolvedValue({
      id: "file-1",
      orderId: "order-1",
      version: 5,
      archivedAt: null,
      requiresClientApproval: false,
      currentRevisionNumber: 3,
    });
    const storage = baseStorage();

    await expect(
      addStyleDirectionFileRevision(
        { organizationId: "org-1", fileId: "file-1", expectedVersion: 1, uploadedByStaffId: "staff-1" },
        validUpload,
        repository,
        storage,
      ),
    ).rejects.toThrow("This Style Direction File changed. Reload and try again.");
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("deletes the uploaded object if the database update fails", async () => {
    const repository = baseRepository();
    repository.getFileForRevision.mockResolvedValue({
      id: "file-1",
      orderId: "order-1",
      version: 1,
      archivedAt: null,
      requiresClientApproval: false,
      currentRevisionNumber: 1,
    });
    repository.addRevision.mockRejectedValue(new Error("db exploded"));
    const storage = baseStorage();

    await expect(
      addStyleDirectionFileRevision(
        { organizationId: "org-1", fileId: "file-1", expectedVersion: 1, uploadedByStaffId: "staff-1" },
        validUpload,
        repository,
        storage,
      ),
    ).rejects.toThrow("db exploded");
    expect(storage.deleteObject).toHaveBeenCalledWith(expect.stringContaining("orgs/org-1/orders/order-1/style-direction/2-"));
  });
});

describe("archiveStyleDirectionFile / restoreStyleDirectionFile", () => {
  it("allows a Super Admin to archive a Style Direction File", async () => {
    const repository = baseRepository();
    repository.getFileLifecycle.mockResolvedValue({ id: "file-1", version: 1 });
    repository.setArchivedState.mockResolvedValue(undefined);

    const result = await archiveStyleDirectionFile(
      { actor: { organizationId: "org-1", role: "super_admin" }, fileId: "file-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
  });

  it("rejects an Admin Assistant archiving a Style Direction File", async () => {
    const repository = baseRepository();

    await expect(
      archiveStyleDirectionFile(
        { actor: { organizationId: "org-1", role: "admin_assistant" }, fileId: "file-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("You cannot archive this Style Direction File.");
    expect(repository.getFileLifecycle).not.toHaveBeenCalled();
  });

  it("allows a Super Admin to restore a Style Direction File", async () => {
    const repository = baseRepository();
    repository.getFileLifecycle.mockResolvedValue({ id: "file-1", version: 2 });
    repository.setArchivedState.mockResolvedValue(undefined);

    const result = await restoreStyleDirectionFile(
      { actor: { organizationId: "org-1", role: "super_admin" }, fileId: "file-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
  });
});
