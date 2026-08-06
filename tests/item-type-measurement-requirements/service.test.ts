import { describe, expect, it, vi } from "vitest";
import {
  archiveMeasurementRequirement,
  createMeasurementRequirement,
  restoreMeasurementRequirement,
} from "@/lib/item-type-measurement-requirements/service";

function createRepository() {
  return {
    itemTypeBelongsToOrganization: vi.fn().mockResolvedValue(true),
    fieldDefinitionBelongsToOrganization: vi.fn().mockResolvedValue(true),
    createRequirement: vi.fn().mockResolvedValue({ id: "requirement-new" }),
    getRequirementLifecycle: vi.fn(),
    setArchivedState: vi.fn(),
  };
}

describe("createMeasurementRequirement", () => {
  it("allows a Super Admin to require a field for an item type", async () => {
    const repository = createRepository();

    const result = await createMeasurementRequirement(
      { actor: { role: "super_admin" }, organizationId: "org-1", itemTypeId: "type-1", fieldDefinitionId: "field-1" },
      repository,
    );

    expect(result).toEqual({ id: "requirement-new" });
    expect(repository.createRequirement).toHaveBeenCalledWith({
      organizationId: "org-1",
      itemTypeId: "type-1",
      fieldDefinitionId: "field-1",
    });
  });

  it("rejects an Admin Assistant without touching the repository", async () => {
    const repository = createRepository();

    await expect(
      createMeasurementRequirement(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", itemTypeId: "type-1", fieldDefinitionId: "field-1" },
        repository,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repository.createRequirement).not.toHaveBeenCalled();
  });

  it("rejects an item type from another organization", async () => {
    const repository = createRepository();
    repository.itemTypeBelongsToOrganization.mockResolvedValue(false);

    await expect(
      createMeasurementRequirement(
        { actor: { role: "super_admin" }, organizationId: "org-1", itemTypeId: "type-1", fieldDefinitionId: "field-1" },
        repository,
      ),
    ).rejects.toThrow("Item type was not found.");
    expect(repository.createRequirement).not.toHaveBeenCalled();
  });

  it("rejects a measurement field from another organization", async () => {
    const repository = createRepository();
    repository.fieldDefinitionBelongsToOrganization.mockResolvedValue(false);

    await expect(
      createMeasurementRequirement(
        { actor: { role: "super_admin" }, organizationId: "org-1", itemTypeId: "type-1", fieldDefinitionId: "field-1" },
        repository,
      ),
    ).rejects.toThrow("Measurement field was not found.");
    expect(repository.createRequirement).not.toHaveBeenCalled();
  });
});

describe("archiveMeasurementRequirement / restoreMeasurementRequirement", () => {
  it("archives a requirement with a version bump", async () => {
    const repository = createRepository();
    repository.getRequirementLifecycle.mockResolvedValue({ id: "requirement-1", version: 1 });
    repository.setArchivedState.mockResolvedValue(undefined);

    const result = await archiveMeasurementRequirement(
      { actor: { role: "super_admin" }, organizationId: "org-1", requirementId: "requirement-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(
      expect.objectContaining({ archived: true, expectedVersion: 1, nextVersion: 2 }),
    );
  });

  it("rejects an Admin Assistant archiving a requirement", async () => {
    const repository = createRepository();

    await expect(
      archiveMeasurementRequirement(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", requirementId: "requirement-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repository.getRequirementLifecycle).not.toHaveBeenCalled();
  });

  it("rejects a stale version", async () => {
    const repository = createRepository();
    repository.getRequirementLifecycle.mockResolvedValue({ id: "requirement-1", version: 3 });

    await expect(
      archiveMeasurementRequirement(
        { actor: { role: "super_admin" }, organizationId: "org-1", requirementId: "requirement-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("This measurement requirement changed. Reload and try again.");
    expect(repository.setArchivedState).not.toHaveBeenCalled();
  });

  it("restores an archived requirement", async () => {
    const repository = createRepository();
    repository.getRequirementLifecycle.mockResolvedValue({ id: "requirement-1", version: 2 });
    repository.setArchivedState.mockResolvedValue(undefined);

    const result = await restoreMeasurementRequirement(
      { actor: { role: "super_admin" }, organizationId: "org-1", requirementId: "requirement-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
    expect(repository.setArchivedState).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
  });
});
