import { assertCanManageTeam, type StaffRole } from "@/lib/domain/access-control";
import { resolveVersionedUpdate } from "@/lib/domain/concurrency";

type TeamActor = {
  userId: string;
  organizationId: string;
  role: StaffRole;
};

type TeamMember = {
  id: string;
  fullName: string;
  role: StaffRole;
  version: number;
};

export type TeamRepository = {
  getMember(organizationId: string, memberId: string): Promise<TeamMember | null>;
  countActiveSuperAdmins(organizationId: string): Promise<number>;
  changeRoleWithAudit(input: {
    organizationId: string;
    memberId: string;
    role: StaffRole;
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
    actor: TeamActor;
    memberId: string;
    role: StaffRole;
    expectedVersion: number;
  },
  repository: TeamRepository,
) {
  assertCanManageTeam(input.actor.role);
  const member = await repository.getMember(input.actor.organizationId, input.memberId);
  if (!member) throw new Error("Team member was not found.");

  const version = resolveVersionedUpdate({
    expectedVersion: input.expectedVersion,
    currentVersion: member.version,
  });
  if (!version.ok) throw new Error("This team member changed. Reload and try again.");

  if (member.role === "super_admin" && input.role !== "super_admin") {
    const count = await repository.countActiveSuperAdmins(input.actor.organizationId);
    if (count <= 1) {
      throw new Error("The organization must keep at least one Super Admin.");
    }
  }

  await repository.changeRoleWithAudit({
    organizationId: input.actor.organizationId,
    memberId: input.memberId,
    role: input.role,
    expectedVersion: input.expectedVersion,
    nextVersion: version.nextVersion,
    actorId: input.actor.userId,
    action: "staff.role_changed",
    summary: `Changed ${member.fullName} from ${ROLE_LABELS[member.role]} to ${ROLE_LABELS[input.role]}.`,
    metadata: { previousRole: member.role, newRole: input.role },
  });

  return { ok: true as const, nextVersion: version.nextVersion };
}
