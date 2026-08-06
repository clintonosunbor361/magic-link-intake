import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive, mayRestore } from "@/lib/domain/record-lifecycle";
import type { StaffRole } from "@/lib/domain/access-control";

export type MeasurementValueEditRecord = { id: string; version: number; value: string };

export type MeasurementProfileLifecycleRecord = { id: string; version: number };

export type MeasurementProfileRepository = {
  clientBelongsToOrganization(organizationId: string, clientId: string): Promise<boolean>;
  fieldDefinitionBelongsToOrganization(organizationId: string, fieldDefinitionId: string): Promise<boolean>;
  getOrCreateMeasurementProfile(
    organizationId: string,
    clientId: string,
  ): Promise<{ id: string; version: number; archivedAt: Date | null }>;
  getMeasurementValueForEdit(
    organizationId: string,
    measurementProfileId: string,
    fieldDefinitionId: string,
  ): Promise<MeasurementValueEditRecord | null>;
  createMeasurementValueWithHistory(input: {
    organizationId: string;
    measurementProfileId: string;
    fieldDefinitionId: string;
    value: string;
    note: string | null;
    staffId: string;
  }): Promise<{ id: string; version: number }>;
  updateMeasurementValueWithHistory(input: {
    organizationId: string;
    measurementValueId: string;
    fieldDefinitionId: string;
    expectedVersion: number;
    nextVersion: number;
    value: string;
    note: string | null;
    staffId: string;
    previousValue: string;
  }): Promise<void>;
  getMeasurementProfileLifecycle(organizationId: string, measurementProfileId: string): Promise<MeasurementProfileLifecycleRecord | null>;
  setArchivedState(input: {
    organizationId: string;
    measurementProfileId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function getOrCreateMeasurementProfile(
  input: { organizationId: string; clientId: string },
  repository: MeasurementProfileRepository,
) {
  const clientOk = await repository.clientBelongsToOrganization(input.organizationId, input.clientId);
  if (!clientOk) throw new Error("Client was not found.");
  return repository.getOrCreateMeasurementProfile(input.organizationId, input.clientId);
}

// A field may have no value row yet — expectedVersion 0 is the sentinel for "I believe this
// field is unset." The create branch's unique-constraint violation (two staff racing to set the
// same never-before-set field) is caught and translated by the repository, not here.
export async function setMeasurementValue(
  input: {
    organizationId: string;
    measurementProfileId: string;
    fieldDefinitionId: string;
    value: string;
    note: string | null;
    staffId: string;
    expectedVersion: number;
  },
  repository: MeasurementProfileRepository,
) {
  const value = input.value.trim();
  if (!value) throw new Error("Value is required.");
  const note = input.note?.trim() || null;

  const fieldOk = await repository.fieldDefinitionBelongsToOrganization(input.organizationId, input.fieldDefinitionId);
  if (!fieldOk) throw new Error("Measurement field was not found.");

  const current = await repository.getMeasurementValueForEdit(
    input.organizationId,
    input.measurementProfileId,
    input.fieldDefinitionId,
  );

  if (!current) {
    if (input.expectedVersion !== 0) throw new Error("This field changed. Reload and try again.");
    const created = await repository.createMeasurementValueWithHistory({
      organizationId: input.organizationId,
      measurementProfileId: input.measurementProfileId,
      fieldDefinitionId: input.fieldDefinitionId,
      value,
      note,
      staffId: input.staffId,
    });
    return { ok: true as const, nextVersion: created.version };
  }

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: async () => current,
    notFoundMessage: "This field changed. Reload and try again.",
    staleMessage: "This field changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.updateMeasurementValueWithHistory({
        organizationId: input.organizationId,
        measurementValueId: current.id,
        fieldDefinitionId: input.fieldDefinitionId,
        expectedVersion: input.expectedVersion,
        nextVersion,
        value,
        note,
        staffId: input.staffId,
        previousValue: current.value,
      }),
  });
}

export async function archiveMeasurementProfile(
  input: { actor: { organizationId: string; role: StaffRole }; measurementProfileId: string; expectedVersion: number },
  repository: MeasurementProfileRepository,
) {
  if (!mayArchive("measurement_profile", input.actor.role)) throw new Error("You cannot archive this measurement profile.");
  return setArchivedState(input, true, repository);
}

export async function restoreMeasurementProfile(
  input: { actor: { organizationId: string; role: StaffRole }; measurementProfileId: string; expectedVersion: number },
  repository: MeasurementProfileRepository,
) {
  if (!mayRestore("measurement_profile", input.actor.role)) throw new Error("You cannot restore this measurement profile.");
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { actor: { organizationId: string; role: StaffRole }; measurementProfileId: string; expectedVersion: number },
  archived: boolean,
  repository: MeasurementProfileRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getMeasurementProfileLifecycle(input.actor.organizationId, input.measurementProfileId),
    notFoundMessage: "Measurement profile was not found.",
    staleMessage: "This measurement profile changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.actor.organizationId,
        measurementProfileId: input.measurementProfileId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
