import type { StaffRole } from "@/lib/domain/access-control";

export type LifecycleEntity =
  | "enquiry"
  | "client"
  | "order"
  | "payment"
  | "audit_entry"
  | "private_file";

export type RecordLifecyclePolicy = {
  archive: boolean;
  restore: boolean;
  permanentDelete: boolean;
  purgeAfterDays: number | null;
};

const RECOVERABLE_POLICY: RecordLifecyclePolicy = {
  archive: true,
  restore: true,
  permanentDelete: false,
  purgeAfterDays: null,
};

const POLICIES: Record<LifecycleEntity, RecordLifecyclePolicy> = {
  enquiry: {
    archive: true,
    restore: true,
    permanentDelete: true,
    purgeAfterDays: null,
  },
  client: RECOVERABLE_POLICY,
  order: RECOVERABLE_POLICY,
  payment: RECOVERABLE_POLICY,
  private_file: RECOVERABLE_POLICY,
  audit_entry: {
    archive: false,
    restore: false,
    permanentDelete: false,
    purgeAfterDays: null,
  },
};

export function getRecordLifecyclePolicy(entity: LifecycleEntity): RecordLifecyclePolicy {
  return { ...POLICIES[entity] };
}

export function mayPermanentlyDelete(input: {
  entity: LifecycleEntity;
  role: StaffRole;
  archivedDays: number;
  converted?: boolean;
}): boolean {
  return (
    input.entity === "enquiry" &&
    input.role === "super_admin" &&
    input.archivedDays >= 30 &&
    input.converted === false
  );
}
