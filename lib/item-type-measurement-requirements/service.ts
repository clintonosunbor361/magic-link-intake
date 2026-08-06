import { assertCanManageMeasurementRequirements, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";

export type MeasurementRequirementLifecycleRecord = { id: string; version: number };

export type MeasurementRequirementRepository = {
  itemTypeBelongsToOrganization(organizationId: string, itemTypeId: string): Promise<boolean>;
  fieldDefinitionBelongsToOrganization(organizationId: string, fieldDefinitionId: string): Promise<boolean>;
  createRequirement(input: { organizationId: string; itemTypeId: string; fieldDefinitionId: string }): Promise<{ id: string }>;
  getRequirementLifecycle(organizationId: string, requirementId: string): Promise<MeasurementRequirementLifecycleRecord | null>;
  setArchivedState(input: {
    organizationId: string;
    requirementId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function createMeasurementRequirement(
  input: { actor: { role: StaffRole }; organizationId: string; itemTypeId: string; fieldDefinitionId: string },
  repository: MeasurementRequirementRepository,
) {
  assertCanManageMeasurementRequirements(input.actor.role);

  const itemTypeOk = await repository.itemTypeBelongsToOrganization(input.organizationId, input.itemTypeId);
  if (!itemTypeOk) throw new Error("Item type was not found.");

  const fieldOk = await repository.fieldDefinitionBelongsToOrganization(input.organizationId, input.fieldDefinitionId);
  if (!fieldOk) throw new Error("Measurement field was not found.");

  const created = await repository.createRequirement({
    organizationId: input.organizationId,
    itemTypeId: input.itemTypeId,
    fieldDefinitionId: input.fieldDefinitionId,
  });
  return { id: created.id };
}

export async function archiveMeasurementRequirement(
  input: { actor: { role: StaffRole }; organizationId: string; requirementId: string; expectedVersion: number },
  repository: MeasurementRequirementRepository,
) {
  assertCanManageMeasurementRequirements(input.actor.role);
  return setArchivedState(input, true, repository);
}

export async function restoreMeasurementRequirement(
  input: { actor: { role: StaffRole }; organizationId: string; requirementId: string; expectedVersion: number },
  repository: MeasurementRequirementRepository,
) {
  assertCanManageMeasurementRequirements(input.actor.role);
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { organizationId: string; requirementId: string; expectedVersion: number },
  archived: boolean,
  repository: MeasurementRequirementRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getRequirementLifecycle(input.organizationId, input.requirementId),
    notFoundMessage: "Measurement requirement was not found.",
    staleMessage: "This measurement requirement changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        requirementId: input.requirementId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
