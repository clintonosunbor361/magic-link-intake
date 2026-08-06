import { describe, expect, it, vi } from "vitest";
import {
  archiveMeasurementProfile,
  getOrCreateMeasurementProfile,
  restoreMeasurementProfile,
  setMeasurementValue,
} from "@/lib/measurement-profiles/service";

const baseRepository = () => ({
  clientBelongsToOrganization: vi.fn().mockResolvedValue(true),
  fieldDefinitionBelongsToOrganization: vi.fn().mockResolvedValue(true),
  getOrCreateMeasurementProfile: vi.fn().mockResolvedValue({ id: "profile-1", version: 1, archivedAt: null }),
  getMeasurementValueForEdit: vi.fn(),
  createMeasurementValueWithHistory: vi.fn().mockResolvedValue({ id: "value-new", version: 1 }),
  updateMeasurementValueWithHistory: vi.fn().mockResolvedValue(undefined),
  getMeasurementProfileLifecycle: vi.fn(),
  setArchivedState: vi.fn(),
});

describe("getOrCreateMeasurementProfile", () => {
  it("rejects a Client outside the caller's organization", async () => {
    const repository = baseRepository();
    repository.clientBelongsToOrganization.mockResolvedValue(false);

    await expect(
      getOrCreateMeasurementProfile({ organizationId: "org-1", clientId: "client-from-other-org" }, repository),
    ).rejects.toThrow("Client was not found.");
    expect(repository.getOrCreateMeasurementProfile).not.toHaveBeenCalled();
  });

  it("returns the repository's get-or-create result for a valid Client", async () => {
    const repository = baseRepository();
    const result = await getOrCreateMeasurementProfile({ organizationId: "org-1", clientId: "client-1" }, repository);
    expect(result).toEqual({ id: "profile-1", version: 1, archivedAt: null });
  });
});

describe("setMeasurementValue", () => {
  it("creates the first value for a never-before-set field when expectedVersion is 0", async () => {
    const repository = baseRepository();
    repository.getMeasurementValueForEdit.mockResolvedValue(null);

    const result = await setMeasurementValue(
      {
        organizationId: "org-1",
        measurementProfileId: "profile-1",
        fieldDefinitionId: "field-1",
        value: "38",
        note: null,
        staffId: "staff-1",
        expectedVersion: 0,
      },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 1 });
    expect(repository.createMeasurementValueWithHistory).toHaveBeenCalledWith(
      expect.objectContaining({ measurementProfileId: "profile-1", fieldDefinitionId: "field-1", value: "38", note: null }),
    );
    expect(repository.updateMeasurementValueWithHistory).not.toHaveBeenCalled();
  });

  it("rejects a first-set attempt with a nonzero expectedVersion", async () => {
    const repository = baseRepository();
    repository.getMeasurementValueForEdit.mockResolvedValue(null);

    await expect(
      setMeasurementValue(
        {
          organizationId: "org-1",
          measurementProfileId: "profile-1",
          fieldDefinitionId: "field-1",
          value: "38",
          note: null,
          staffId: "staff-1",
          expectedVersion: 1,
        },
        repository,
      ),
    ).rejects.toThrow("This field changed. Reload and try again.");
    expect(repository.createMeasurementValueWithHistory).not.toHaveBeenCalled();
  });

  it("updates an existing value, passing the current value through as previousValue", async () => {
    const repository = baseRepository();
    repository.getMeasurementValueForEdit.mockResolvedValue({ id: "value-1", version: 1, value: "36" });

    const result = await setMeasurementValue(
      {
        organizationId: "org-1",
        measurementProfileId: "profile-1",
        fieldDefinitionId: "field-1",
        value: "38",
        note: "Client gained weight",
        staffId: "staff-2",
        expectedVersion: 1,
      },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
    expect(repository.updateMeasurementValueWithHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        measurementValueId: "value-1",
        expectedVersion: 1,
        nextVersion: 2,
        value: "38",
        note: "Client gained weight",
        previousValue: "36",
      }),
    );
  });

  it("rejects a stale version on update", async () => {
    const repository = baseRepository();
    repository.getMeasurementValueForEdit.mockResolvedValue({ id: "value-1", version: 5, value: "36" });

    await expect(
      setMeasurementValue(
        {
          organizationId: "org-1",
          measurementProfileId: "profile-1",
          fieldDefinitionId: "field-1",
          value: "38",
          note: null,
          staffId: "staff-1",
          expectedVersion: 1,
        },
        repository,
      ),
    ).rejects.toThrow("This field changed. Reload and try again.");
    expect(repository.updateMeasurementValueWithHistory).not.toHaveBeenCalled();
  });

  it("rejects a blank value", async () => {
    const repository = baseRepository();

    await expect(
      setMeasurementValue(
        {
          organizationId: "org-1",
          measurementProfileId: "profile-1",
          fieldDefinitionId: "field-1",
          value: "   ",
          note: null,
          staffId: "staff-1",
          expectedVersion: 0,
        },
        repository,
      ),
    ).rejects.toThrow("Value is required.");
    expect(repository.fieldDefinitionBelongsToOrganization).not.toHaveBeenCalled();
  });

  it("rejects a field definition outside the caller's organization", async () => {
    const repository = baseRepository();
    repository.fieldDefinitionBelongsToOrganization.mockResolvedValue(false);

    await expect(
      setMeasurementValue(
        {
          organizationId: "org-1",
          measurementProfileId: "profile-1",
          fieldDefinitionId: "field-from-other-org",
          value: "38",
          note: null,
          staffId: "staff-1",
          expectedVersion: 0,
        },
        repository,
      ),
    ).rejects.toThrow("Measurement field was not found.");
    expect(repository.getMeasurementValueForEdit).not.toHaveBeenCalled();
  });

  it("surfaces the repository's unique-violation translation for a first-set race", async () => {
    const repository = baseRepository();
    repository.getMeasurementValueForEdit.mockResolvedValue(null);
    repository.createMeasurementValueWithHistory.mockRejectedValue(new Error("This field changed. Reload and try again."));

    await expect(
      setMeasurementValue(
        {
          organizationId: "org-1",
          measurementProfileId: "profile-1",
          fieldDefinitionId: "field-1",
          value: "38",
          note: null,
          staffId: "staff-1",
          expectedVersion: 0,
        },
        repository,
      ),
    ).rejects.toThrow("This field changed. Reload and try again.");
  });
});

describe("archiveMeasurementProfile / restoreMeasurementProfile", () => {
  it("allows a Super Admin to archive a measurement profile", async () => {
    const repository = baseRepository();
    repository.getMeasurementProfileLifecycle.mockResolvedValue({ id: "profile-1", version: 1 });
    repository.setArchivedState.mockResolvedValue(undefined);

    const result = await archiveMeasurementProfile(
      { actor: { organizationId: "org-1", role: "super_admin" }, measurementProfileId: "profile-1", expectedVersion: 1 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 2 });
  });

  it("rejects an Admin Assistant archiving a measurement profile", async () => {
    const repository = baseRepository();

    await expect(
      archiveMeasurementProfile(
        { actor: { organizationId: "org-1", role: "admin_assistant" }, measurementProfileId: "profile-1", expectedVersion: 1 },
        repository,
      ),
    ).rejects.toThrow("You cannot archive this measurement profile.");
    expect(repository.getMeasurementProfileLifecycle).not.toHaveBeenCalled();
  });

  it("allows a Super Admin to restore a measurement profile", async () => {
    const repository = baseRepository();
    repository.getMeasurementProfileLifecycle.mockResolvedValue({ id: "profile-1", version: 2 });
    repository.setArchivedState.mockResolvedValue(undefined);

    const result = await restoreMeasurementProfile(
      { actor: { organizationId: "org-1", role: "super_admin" }, measurementProfileId: "profile-1", expectedVersion: 2 },
      repository,
    );

    expect(result).toEqual({ ok: true, nextVersion: 3 });
  });
});
