import { assertCanManageVendors, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedTransition } from "@/lib/domain/concurrency";
import { mayArchive } from "@/lib/domain/record-lifecycle";

export type VendorLifecycleRecord = { id: string; version: number };

export type VendorContactInput = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export type VendorRepository = {
  createVendor(input: {
    organizationId: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    specialtyIds: string[];
  }): Promise<{ id: string }>;
  getVendor(organizationId: string, vendorId: string): Promise<VendorLifecycleRecord | null>;
  updateVendor(input: {
    organizationId: string;
    vendorId: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
  setArchivedState(input: {
    organizationId: string;
    vendorId: string;
    archived: boolean;
    expectedVersion: number;
    nextVersion: number;
  }): Promise<void>;
  replaceSpecialties(input: {
    organizationId: string;
    vendorId: string;
    specialtyIds: string[];
  }): Promise<void>;
  countLiveSpecialties(organizationId: string, specialtyIds: string[]): Promise<number>;
};

function normalizeContact(input: VendorContactInput): VendorContactInput {
  const name = input.name.trim();
  if (!name) throw new Error("Vendor name is required.");

  return {
    name,
    phone: blankToNull(input.phone),
    email: blankToNull(input.email),
    address: blankToNull(input.address),
  };
}

function blankToNull(value: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

async function assertSpecialtiesBelongToOrganization(
  organizationId: string,
  specialtyIds: string[],
  repository: VendorRepository,
) {
  if (!specialtyIds.length) return;
  const unique = [...new Set(specialtyIds)];
  const found = await repository.countLiveSpecialties(organizationId, unique);
  if (found !== unique.length) throw new Error("One or more specialties are unavailable.");
}

/**
 * Covers both the full Vendor form and quick-create from the assignment picker — quick-create
 * simply supplies name only, with phone and specialty optional, exactly as the spec describes.
 */
export async function createVendor(
  input: {
    actor: { role: StaffRole };
    organizationId: string;
    specialtyIds?: string[];
  } & VendorContactInput,
  repository: VendorRepository,
) {
  assertCanManageVendors(input.actor.role);
  const contact = normalizeContact(input);
  const specialtyIds = [...new Set(input.specialtyIds ?? [])];
  await assertSpecialtiesBelongToOrganization(input.organizationId, specialtyIds, repository);

  return repository.createVendor({ organizationId: input.organizationId, ...contact, specialtyIds });
}

export async function updateVendor(
  input: {
    actor: { role: StaffRole };
    organizationId: string;
    vendorId: string;
    expectedVersion: number;
    specialtyIds?: string[];
  } & VendorContactInput,
  repository: VendorRepository,
) {
  assertCanManageVendors(input.actor.role);
  const contact = normalizeContact(input);
  const specialtyIds = input.specialtyIds ? [...new Set(input.specialtyIds)] : null;
  if (specialtyIds) await assertSpecialtiesBelongToOrganization(input.organizationId, specialtyIds, repository);

  const result = await resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getVendor(input.organizationId, input.vendorId),
    notFoundMessage: "Vendor was not found.",
    staleMessage: "This Vendor changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.updateVendor({
        organizationId: input.organizationId,
        vendorId: input.vendorId,
        ...contact,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });

  if (specialtyIds) {
    await repository.replaceSpecialties({
      organizationId: input.organizationId,
      vendorId: input.vendorId,
      specialtyIds,
    });
  }

  return result;
}

export async function archiveVendor(
  input: { actor: { role: StaffRole }; organizationId: string; vendorId: string; expectedVersion: number },
  repository: VendorRepository,
) {
  return setVendorArchivedState(input, true, repository);
}

export async function restoreVendor(
  input: { actor: { role: StaffRole }; organizationId: string; vendorId: string; expectedVersion: number },
  repository: VendorRepository,
) {
  return setVendorArchivedState(input, false, repository);
}

function setVendorArchivedState(
  input: { actor: { role: StaffRole }; organizationId: string; vendorId: string; expectedVersion: number },
  archived: boolean,
  repository: VendorRepository,
) {
  // Archive/restore of a Vendor is a major operational lifecycle action, so it defers to the
  // Milestone 0 policy rather than re-deciding the rule here.
  if (!mayArchive("vendor", input.actor.role)) throw new Error("Super Admin access is required.");

  return resolveVersionedTransition({
    expectedVersion: input.expectedVersion,
    fetchCurrent: () => repository.getVendor(input.organizationId, input.vendorId),
    notFoundMessage: "Vendor was not found.",
    staleMessage: "This Vendor changed. Reload and try again.",
    persist: (nextVersion) =>
      repository.setArchivedState({
        organizationId: input.organizationId,
        vendorId: input.vendorId,
        archived,
        expectedVersion: input.expectedVersion,
        nextVersion,
      }),
  });
}
