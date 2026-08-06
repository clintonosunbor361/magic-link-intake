import { describe, expect, it, vi } from "vitest";
import {
  archiveMeasurementFieldDefinition,
  createMeasurementFieldDefinition,
  restoreMeasurementFieldDefinition,
} from "@/lib/measurement-field-definitions/service";

describe("createMeasurementFieldDefinition", () => {
  it("allows a Super Admin to create a field", async () => {
    const repository = {
      createMeasurementFieldDefinition: vi.fn().mockResolvedValue({ id: "field-new" }),
      getMeasurementFieldDefinition: vi.fn(),
      setArchivedState: vi.fn(),
    };

    const result = await createMeasurementFieldDefinition(
      { actor: { role: "super_admin" }, organizationId: "org-1", name: "Chest", unit: "in", sortOrder: 0 },
      repository,
    );

    expect(result).toEqual({ id: "field-new" });
    expect(repository.createMeasurementFieldDefinition).toHaveBeenCalledWith({
      organizationId: "org-1",
      name: "Chest",
      unit: "in",
      sortOrder: 0,
    });
  });

  it("rejects an Admin Assistant without touching the repository", async () => {
    const repository = {
      createMeasurementFieldDefinition: vi.fn(),
      getMeasurementFieldDefinition: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createMeasurementFieldDefinition(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", name: "Chest", unit: "in", sortOrder: 0 },
        repository,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repository.createMeasurementFieldDefinition).not.toHaveBeenCalled();
  });

  it("rejects a blank name", async () => {
    const repository = {
      createMeasurementFieldDefinition: vi.fn(),
      getMeasurementFieldDefinition: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createMeasurementFieldDefinition(
        { actor: { role: "super_admin" }, organizationId: "org-1", name: "  ", unit: "in", sortOrder: 0 },
        repository,
      ),
    ).rejects.toThrow("Field name is required.");
  });

  it("rejects a blank unit", async () => {
    const repository = {
      createMeasurementFieldDefinition: vi.fn(),
      getMeasurementFieldDefinition: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      createMeasurementFieldDefinition(
        { actor: { role: "super_admin" }, organizationId: "org-1", name: "Chest", unit: "  ", sortOrder: 0 },
        repository,
      ),
    ).rejects.toThrow("Unit is required.");
  });
});

describe("archiveMeasurementFieldDefinition / restoreMeasurementFieldDefinition", () => {
  it("archives a field with a version bump", async () => {
    const repository = {
      createMeasurementFieldDefinition: vi.fn(),
      getMeasurementFieldDefinition: vi.fn().mockResolvedValue({ id: "field-1", version: 1 }),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await archiveMeasurementFieldDefinition(
      { actor: { role: "super_admin" }, organizationId: "org-1", fieldDefinitionId: "field-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
  });

  it("rejects an Admin Assistant archiving a field", async () => {
    const repository = {
      createMeasurementFieldDefinition: vi.fn(),
      getMeasurementFieldDefinition: vi.fn(),
      setArchivedState: vi.fn(),
    };

    await expect(
      archiveMeasurementFieldDefinition(
        { actor: { role: "admin_assistant" }, organizationId: "org-1", fieldDefinitionId: "field-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("Super Admin access is required.");
    expect(repository.getMeasurementFieldDefinition).not.toHaveBeenCalled();
  });

  it("restores an archived field", async () => {
    const repository = {
      createMeasurementFieldDefinition: vi.fn(),
      getMeasurementFieldDefinition: vi.fn().mockResolvedValue({ id: "field-1", version: 2 }),
      setArchivedState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await restoreMeasurementFieldDefinition(
      { actor: { role: "super_admin" }, organizationId: "org-1", fieldDefinitionId: "field-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
  });
});
