import { assertCanManageVendorSpecialties, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";

// Same shape as item types and consultation note sources: a Super-Admin-curated list that Admin
// Assistants select from. Archiving removes a tag from selection but leaves existing vendor
// associations intact, so a Vendor's history keeps the tag it was actually chosen under.

export type VendorSpecialtyLifecycleRecord = { id: string; version: number };

export type VendorSpecialtyRepository = {
  createVendorSpecialty(input: { organizationId: string; name: string; sortOrder: number }): Promise<{ id: string }>;
  getVendorSpecialty(organizationId: string, specialtyId: string): Promise<VendorSpecialtyLifecycleRecord | null>;
  setArchivedState(input: {
    organizationId: string;
    specialtyId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
};

export async function createVendorSpecialty(
  input: { actor: { role: StaffRole }; organizationId: string; name: string; sortOrder: number },
  repository: VendorSpecialtyRepository,
) {
  assertCanManageVendorSpecialties(input.actor.role);
  const name = input.name.trim();
  if (!name) throw new Error("Specialty name is required.");

  return repository.createVendorSpecialty({
    organizationId: input.organizationId,
    name,
    sortOrder: input.sortOrder,
  });
}

export async function archiveVendorSpecialty(
  input: { actor: { role: StaffRole }; organizationId: string; specialtyId: string; expectedVersion: number },
  repository: VendorSpecialtyRepository,
) {
  assertCanManageVendorSpecialties(input.actor.role);
  return setArchivedState(input, true, repository);
}

export async function restoreVendorSpecialty(
  input: { actor: { role: StaffRole }; organizationId: string; specialtyId: string; expectedVersion: number },
  repository: VendorSpecialtyRepository,
) {
  assertCanManageVendorSpecialties(input.actor.role);
  return setArchivedState(input, false, repository);
}

function setArchivedState(
  input: { organizationId: string; specialtyId: string; expectedVersion: number },
  archived: boolean,
  repository: VendorSpecialtyRepository,
) {
  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getVendorSpecialty(input.organizationId, input.specialtyId),
    notFoundMessage: "Specialty was not found.",
    staleMessage: "This specialty changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        specialtyId: input.specialtyId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
