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
