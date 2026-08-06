import { assertCanManageMeasurementFieldDefinitions, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";

export type MeasurementFieldDefinitionLifecycleRecord = { id: string; version: number };

export type MeasurementFieldDefinitionRepository = {
  createMeasurementFieldDefinition(input: {
    organizationId: string;
    name: string;
    unit: string;
    sortOrder: number;
  }): Promise<{ id: string }>;
  getMeasurementFieldDefinition(organizationId: string, fieldDefinitionId: string): Promise<MeasurementFieldDefinitionLifecycleRecord | null>;
  setArchivedState(input: {
    organizationId: string;
    fieldDefinitionId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function createMeasurementFieldDefinition(
  input: { actor: { role: StaffRole }; organizationId: string; name: string; unit: string; sortOrder: number },
  repository: MeasurementFieldDefinitionRepository,
) {
  assertCanManageMeasurementFieldDefinitions(input.actor.role);
  if (!input.name.trim()) throw new Error("Field name is required.");
  if (!input.unit.trim()) throw new Error("Unit is required.");

  const created = await repository.createMeasurementFieldDefinition({
    organizationId: input.organizationId,
    name: input.name.trim(),
    unit: input.unit.trim(),
    sortOrder: input.sortOrder,
  });
  return { id: created.id };
}

export async function archiveMeasurementFieldDefinition(
  input: { actor: { role: StaffRole }; organizationId: string; fieldDefinitionId: string; expectedVersion: number },
  repository: MeasurementFieldDefinitionRepository,
) {
  assertCanManageMeasurementFieldDefinitions(input.actor.role);
  return setArchivedState(input, true, repository);
}

export async function restoreMeasurementFieldDefinition(
  input: { actor: { role: StaffRole }; organizationId: string; fieldDefinitionId: string; expectedVersion: number },
  repository: MeasurementFieldDefinitionRepository,
) {
  assertCanManageMeasurementFieldDefinitions(input.actor.role);
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { organizationId: string; fieldDefinitionId: string; expectedVersion: number },
  archived: boolean,
  repository: MeasurementFieldDefinitionRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getMeasurementFieldDefinition(input.organizationId, input.fieldDefinitionId),
    notFoundMessage: "Measurement field was not found.",
    staleMessage: "This measurement field changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        fieldDefinitionId: input.fieldDefinitionId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
