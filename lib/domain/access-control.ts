export const STAFF_ROLES = ["super_admin", "admin_assistant"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function canManageTeam(role: StaffRole): boolean {
  return role === "super_admin";
}

export function canPerformOperationalWork(role: StaffRole): boolean {
  return STAFF_ROLES.includes(role);
}

export function assertCanManageTeam(role: StaffRole): void {
  if (!canManageTeam(role)) {
    throw new Error("Super Admin access is required.");
  }
}

export function canManageItemTypes(role: StaffRole): boolean {
  return role === "super_admin";
}

export function assertCanManageItemTypes(role: StaffRole): void {
  if (!canManageItemTypes(role)) {
    throw new Error("Super Admin access is required.");
  }
}

export function canManageConsultationNoteSources(role: StaffRole): boolean {
  return role === "super_admin";
}

export function assertCanManageConsultationNoteSources(role: StaffRole): void {
  if (!canManageConsultationNoteSources(role)) {
    throw new Error("Super Admin access is required.");
  }
}

export function canManageMeasurementFieldDefinitions(role: StaffRole): boolean {
  return role === "super_admin";
}

export function assertCanManageMeasurementFieldDefinitions(role: StaffRole): void {
  if (!canManageMeasurementFieldDefinitions(role)) {
    throw new Error("Super Admin access is required.");
  }
}

export function canManageMeasurementRequirements(role: StaffRole): boolean {
  return role === "super_admin";
}

export function assertCanManageMeasurementRequirements(role: StaffRole): void {
  if (!canManageMeasurementRequirements(role)) {
    throw new Error("Super Admin access is required.");
  }
}

export function canManageVendorSpecialties(role: StaffRole): boolean {
  return role === "super_admin";
}

export function assertCanManageVendorSpecialties(role: StaffRole): void {
  if (!canManageVendorSpecialties(role)) {
    throw new Error("Super Admin access is required.");
  }
}

export function canManageProductionStatuses(role: StaffRole): boolean {
  return role === "super_admin";
}

export function assertCanManageProductionStatuses(role: StaffRole): void {
  if (!canManageProductionStatuses(role)) {
    throw new Error("Super Admin access is required.");
  }
}

// Creating a Vendor is operational work: the spec requires quick-create straight from the
// assignment picker, which an Admin Assistant must be able to use mid-flow. Archiving one is not —
// that follows the Milestone 0 lifecycle policy and is reserved for Super Admin (see
// mayArchive in lib/domain/record-lifecycle).
export function canManageVendors(role: StaffRole): boolean {
  return canPerformOperationalWork(role);
}

export function assertCanManageVendors(role: StaffRole): void {
  if (!canManageVendors(role)) {
    throw new Error("Staff access is required.");
  }
}

export function canAssignVendors(role: StaffRole): boolean {
  return canPerformOperationalWork(role);
}

export function assertCanAssignVendors(role: StaffRole): void {
  if (!canAssignVendors(role)) {
    throw new Error("Staff access is required.");
  }
}

// Rating a Vendor is a judgement about operational work, not a financial or destructive action, so
// the assistant who ran the Order can close it out.
export function canRateVendors(role: StaffRole): boolean {
  return canPerformOperationalWork(role);
}

export function assertCanRateVendors(role: StaffRole): void {
  if (!canRateVendors(role)) {
    throw new Error("Staff access is required.");
  }
}

export function canOverrideBriefBlocker(role: StaffRole): boolean {
  return role === "super_admin";
}

// Every financial action — creating and editing Invoices, sending, voiding, and recording, editing
// or voiding a payment on either side — is reserved for Super Admin by product decision. This is
// stricter than reserving only edits and deletes: an Admin Assistant does no money entry at all.
export function canManageFinance(role: StaffRole): boolean {
  return role === "super_admin";
}

export function assertCanManageFinance(role: StaffRole): void {
  if (!canManageFinance(role)) {
    throw new Error("Super Admin access is required for financial records.");
  }
}

export function canOverrideCompletionGate(role: StaffRole): boolean {
  return role === "super_admin";
}

// Accessory types and statuses follow the configurable-list rule the spec states for every such
// list: Super Admin manages what exists, Admin Assistant only selects from it.
export function canManageAccessoryTypes(role: StaffRole): boolean {
  return role === "super_admin";
}

export function assertCanManageAccessoryTypes(role: StaffRole): void {
  if (!canManageAccessoryTypes(role)) {
    throw new Error("Super Admin access is required.");
  }
}

export function canManageAccessoryStatuses(role: StaffRole): boolean {
  return role === "super_admin";
}

export function assertCanManageAccessoryStatuses(role: StaffRole): void {
  if (!canManageAccessoryStatuses(role)) {
    throw new Error("Super Admin access is required.");
  }
}

// Sourcing an accessory and running a fitting are operational work: both roles do it. Neither is
// financial, and neither is destructive.
export function canManageAccessoryItems(role: StaffRole): boolean {
  return canPerformOperationalWork(role);
}

export function assertCanManageAccessoryItems(role: StaffRole): void {
  if (!canManageAccessoryItems(role)) {
    throw new Error("Staff access is required.");
  }
}

export function canManageFittingSessions(role: StaffRole): boolean {
  return canPerformOperationalWork(role);
}

export function assertCanManageFittingSessions(role: StaffRole): void {
  if (!canManageFittingSessions(role)) {
    throw new Error("Staff access is required.");
  }
}
