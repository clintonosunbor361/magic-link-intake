import { assertCanManageTeam, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedUpdate } from "@/lib/domain/concurrency";

type StaffActor = {
  userId: string;
  organizationId: string;
  role: StaffRole;
};

type StaffMember = {
  id: string;
  fullName: string;
  role: StaffRole;
  version: number;
};

export type StaffRepository = {
  getStaffMember(organizationId: string, staffMemberId: string): Promise<StaffMember | null>;
  changeRoleWithAudit(input: {
    organizationId: string;
    staffMemberId: string;
    role: StaffRole;
    previousRole: StaffRole;
    expectedVersion: number;
    nextVersion: number;
    actorId: string;
    action: string;
    summary: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
};

const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  admin_assistant: "Admin Assistant",
};

export async function changeStaffRole(
  input: {
    actor: StaffActor;
    staffMemberId: string;
    role: StaffRole;
    expectedVersion: number;
  },
  repository: StaffRepository,
) {
  assertCanManageTeam(input.actor.role);
  const staffMember = await repository.getStaffMember(
    input.actor.organizationId,
    input.staffMemberId,
  );
  if (!staffMember) throw new Error("Staff Member was not found.");

  const version = resolveVersionedUpdate({
    expectedVersion: input.expectedVersion,
    currentVersion: staffMember.version,
  });
  if (!version.ok) throw new Error("This Staff Member changed. Reload and try again.");

  await repository.changeRoleWithAudit({
    organizationId: input.actor.organizationId,
    staffMemberId: input.staffMemberId,
    role: input.role,
    previousRole: staffMember.role,
    expectedVersion: input.expectedVersion,
    nextVersion: version.nextVersion,
    actorId: input.actor.userId,
    action: "staff.role_changed",
    summary: `Changed ${staffMember.fullName} from ${ROLE_LABELS[staffMember.role]} to ${ROLE_LABELS[input.role]}.`,
    metadata: { previousRole: staffMember.role, newRole: input.role },
  });

  return { ok: true as const, nextVersion: version.nextVersion };
}
