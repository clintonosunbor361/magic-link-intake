import type { StaffRole } from "@/lib/domain/access-control";

export const LIFECYCLE_ENTITIES = [
  "enquiry",
  "enquiry_note",
  "enquiry_task",
  "client",
  "client_task",
  "order",
  "look",
  "item",
  "consultation_note",
  "style_direction_file",
  "file_revision",
  "measurement_profile",
  "measurement_profile_attachment",
  "vendor",
  "vendor_assignment",
  "invoice",
  "client_payment",
  "vendor_payment",
  "accessory_item",
  "fitting_session",
  "vendor_rating",
  "notification",
  "audit_entry",
  "private_file",
] as const;

export type LifecycleEntity = (typeof LIFECYCLE_ENTITIES)[number];
export type RecordLifecyclePolicy = {
  archive: boolean;
  restore: boolean;
  permanentDelete: boolean;
  purgeAfterDays: number | null;
};

const IMMUTABLE_EVIDENCE = new Set<LifecycleEntity>([
  "invoice",
  "client_payment",
  "vendor_payment",
  "audit_entry",
]);

export function getRecordLifecyclePolicy(entity: LifecycleEntity): RecordLifecyclePolicy {
  if (IMMUTABLE_EVIDENCE.has(entity)) {
    return { archive: false, restore: false, permanentDelete: false, purgeAfterDays: null };
  }
  return {
    archive: true,
    restore: true,
    permanentDelete: entity === "enquiry" || entity === "private_file",
    purgeAfterDays: null,
  };
}

export function mayArchive(entity: LifecycleEntity, role: StaffRole): boolean {
  if (!getRecordLifecyclePolicy(entity).archive) return false;
  return entity === "enquiry" || entity === "enquiry_note" || entity === "enquiry_task" || entity === "client_task"
    ? true
    : role === "super_admin";
}

export function mayRestore(entity: LifecycleEntity, role: StaffRole): boolean {
  return getRecordLifecyclePolicy(entity).restore && mayArchive(entity, role);
}

export function mayPermanentlyDelete(input: {
  entity: LifecycleEntity;
  role: StaffRole;
  archivedDays: number;
  converted?: boolean;
  belongsToPurgeableEnquiry?: boolean;
}): boolean {
  if (input.role !== "super_admin" || input.archivedDays < 30) return false;
  if (input.entity === "enquiry") return input.converted === false;
  return input.entity === "private_file" && input.belongsToPurgeableEnquiry === true;
}

export const ARCHIVE_CASCADE = {
  behavior: "visibility_only",
  description:
    "Archiving a parent hides its dependent records without changing their individual archive timestamps; restoring the parent restores their visibility.",
} as const;
