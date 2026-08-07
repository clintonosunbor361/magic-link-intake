import { describe, expect, it, vi } from "vitest";
import { archiveVendor, createVendor, restoreVendor, updateVendor } from "@/lib/vendors/service";

function repository(overrides: Record<string, unknown> = {}) {
  return {
    createVendor: vi.fn().mockResolvedValue({ id: "vendor-new" }),
    getVendor: vi.fn().mockResolvedValue({ id: "vendor-1", version: 1 }),
    updateVendor: vi.fn().mockResolvedValue(undefined),
    setArchivedState: vi.fn().mockResolvedValue(undefined),
    replaceSpecialties: vi.fn().mockResolvedValue(undefined),
    countLiveSpecialties: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe("createVendor", () => {
  it("lets an Admin Assistant quick-create with name only", async () => {
    const repo = repository();

    const result = await createVendor(
      {
        actor: { role: "admin_assistant" },
        organizationId: "org-1",
        name: "  Tunde Fabrics  ",
        phone: null,
        email: null,
        address: null,
      },
      repo,
    );

    expect(result).toEqual({ id: "vendor-new" });
    expect(repo.createVendor).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Tunde Fabrics", phone: null, specialtyIds: [] }),
    );
  });

  it("normalises blank contact fields to null", async () => {
    const repo = repository();

    await createVendor(
      {
        actor: { role: "super_admin" },
        organizationId: "org-1",
        name: "Bola Tailors",
        phone: "  ",
        email: "",
        address: "   ",
      },
      repo,
    );

    expect(repo.createVendor).toHaveBeenCalledWith(
      expect.objectContaining({ phone: null, email: null, address: null }),
    );
  });

  it("rejects a blank name", async () => {
    const repo = repository();

    await expect(
      createVendor(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", name: "   ", phone: null, email: null, address: null },
        repo,
      ),
    ).rejects.toThrow("Vendor name is required.");
  });

  it("rejects specialties that do not belong to the organization", async () => {
    const repo = repository({ countLiveSpecialties: vi.fn().mockResolvedValue(1) });

    await expect(
      createVendor(
        {
          actor: { role: "admin_assistant" },
          organizationId: "org-1",
          name: "Tunde Fabrics",
          phone: null,
          email: null,
          address: null,
          specialtyIds: ["spec-1", "spec-other"],
        },
        repo,
      ),
    ).rejects.toThrow("One or more specialties are unavailable.");
    expect(repo.createVendor).not.toHaveBeenCalled();
  });

  it("de-duplicates repeated specialty selections", async () => {
    const repo = repository({ countLiveSpecialties: vi.fn().mockResolvedValue(1) });

    await createVendor(
      {
        actor: { role: "admin_assistant" },
        organizationId: "org-1",
        name: "Tunde Fabrics",
        phone: null,
        email: null,
        address: null,
        specialtyIds: ["spec-1", "spec-1"],
      },
      repo,
    );

    expect(repo.createVendor).toHaveBeenCalledWith(expect.objectContaining({ specialtyIds: ["spec-1"] }));
  });
});

describe("updateVendor", () => {
  it("updates contact details and replaces specialties", async () => {
    const repo = repository({ countLiveSpecialties: vi.fn().mockResolvedValue(2) });

    const result = await updateVendor(
      {
        actor: { role: "admin_assistant" },
        organizationId: "org-1",
        vendorId: "vendor-1",
        expectedVersion: 1,
        name: "Tunde Fabrics",
        phone: "+2348012345678",
        email: null,
        address: null,
        specialtyIds: ["spec-1", "spec-2"],
      },
      repo,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repo.replaceSpecialties).toHaveBeenCalledWith(
      expect.objectContaining({ vendorId: "vendor-1", specialtyIds: ["spec-1", "spec-2"] }),
    );
  });

  it("leaves specialties untouched when none are supplied", async () => {
    const repo = repository();

    await updateVendor(
      {
        actor: { role: "admin_assistant" },
        organizationId: "org-1",
        vendorId: "vendor-1",
        expectedVersion: 1,
        name: "Tunde Fabrics",
        phone: null,
        email: null,
        address: null,
      },
      repo,
    );

    expect(repo.replaceSpecialties).not.toHaveBeenCalled();
  });

  it("rejects a stale version", async () => {
    const repo = repository({ getVendor: vi.fn().mockResolvedValue({ id: "vendor-1", version: 5 }) });

    await expect(
      updateVendor(
        {
          actor: { role: "admin_assistant" },
          organizationId: "org-1",
          vendorId: "vendor-1",
          expectedVersion: 1,
          name: "Tunde Fabrics",
          phone: null,
          email: null,
          address: null,
        },
        repo,
      ),
    ).rejects.toThrow("Reload and try again");
  });
});

describe("archiveVendor / restoreVendor", () => {
  it("reserves archiving for a Super Admin, per the lifecycle policy", async () => {
    const repo = repository();

    await expect(
      archiveVendor(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", vendorId: "vendor-1", expectedVersion: 1 },
        repo,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repo.setArchivedState).not.toHaveBeenCalled();
  });

  it("archives for a Super Admin with a version bump", async () => {
    const repo = repository();

    const result = await archiveVendor(
      { actor: { role: "super_admin" }, organizationId: "org-1", vendorId: "vendor-1", expectedVersion: 1 },
      repo,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repo.setArchivedState).toHaveBeenCalledWith(expect.objectContaining({ archived: true }));
  });

  it("restores for a Super Admin", async () => {
    const repo = repository({ getVendor: vi.fn().mockResolvedValue({ id: "vendor-1", version: 2 }) });

    await restoreVendor(
      { actor: { role: "super_admin" }, organizationId: "org-1", vendorId: "vendor-1", expectedVersion: 2 },
      repo,
    );

    expect(repo.setArchivedState).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
  });
});
