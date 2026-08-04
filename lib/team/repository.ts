import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";
import { auditEntries, organizationMemberships, staffProfiles } from "@/db/schema";
import { getDatabase } from "@/db";
import type { StaffRole } from "@/lib/domain/access-control";
import type { TeamRepository } from "@/lib/team/service";

export function createTeamRepository(): TeamRepository {
  const db = getDatabase();
  return {
    async getMember(organizationId, memberId) {
      const [row] = await db
        .select({
          id: organizationMemberships.userId,
          fullName: staffProfiles.fullName,
          role: organizationMemberships.role,
          version: organizationMemberships.version,
        })
        .from(organizationMemberships)
        .innerJoin(staffProfiles, eq(staffProfiles.id, organizationMemberships.userId))
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.userId, memberId),
            isNull(organizationMemberships.archivedAt),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async countActiveSuperAdmins(organizationId) {
      const [row] = await db
        .select({ value: count() })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.role, "super_admin"),
            isNull(organizationMemberships.archivedAt),
          ),
        );
      return row?.value ?? 0;
    },
    async changeRoleWithAudit(input) {
      await db.transaction(async (transaction) => {
        const rows = await transaction
          .update(organizationMemberships)
          .set({ role: input.role, version: input.nextVersion, updatedAt: new Date() })
          .where(
            and(
              eq(organizationMemberships.organizationId, input.organizationId),
              eq(organizationMemberships.userId, input.memberId),
              eq(organizationMemberships.version, input.expectedVersion),
            ),
          )
          .returning({ id: organizationMemberships.id });
        if (!rows.length) throw new Error("This team member changed. Reload and try again.");
        await transaction.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorId,
          action: input.action,
          entityType: "staff_membership",
          entityId: input.memberId,
          summary: input.summary,
          metadata: input.metadata,
        });
      });
    },
  };
}

export async function listTeamMembers(organizationId: string) {
  return getDatabase()
    .select({
      userId: organizationMemberships.userId,
      fullName: staffProfiles.fullName,
      email: staffProfiles.email,
      role: organizationMemberships.role,
      version: organizationMemberships.version,
      joinedAt: organizationMemberships.createdAt,
    })
    .from(organizationMemberships)
    .innerJoin(staffProfiles, eq(staffProfiles.id, organizationMemberships.userId))
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        isNull(organizationMemberships.archivedAt),
      ),
    )
    .orderBy(staffProfiles.fullName);
}

export async function listAuditEntries(organizationId: string, limit = 40) {
  return getDatabase()
    .select({
      id: auditEntries.id,
      action: auditEntries.action,
      summary: auditEntries.summary,
      createdAt: auditEntries.createdAt,
      actorName: staffProfiles.fullName,
    })
    .from(auditEntries)
    .leftJoin(staffProfiles, eq(staffProfiles.id, auditEntries.actorId))
    .where(eq(auditEntries.organizationId, organizationId))
    .orderBy(desc(auditEntries.createdAt))
    .limit(limit);
}

export async function addInvitedTeamMember(input: {
  organizationId: string;
  actorId: string;
  userId: string;
  fullName: string;
  email: string;
  role: StaffRole;
}) {
  const db = getDatabase();
  await db.transaction(async (transaction) => {
    await transaction
      .insert(staffProfiles)
      .values({ id: input.userId, fullName: input.fullName, email: input.email })
      .onConflictDoUpdate({
        target: staffProfiles.id,
        set: { fullName: input.fullName, email: input.email, updatedAt: new Date() },
      });
    await transaction.insert(organizationMemberships).values({
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
    });
    await transaction.insert(auditEntries).values({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "staff.invited",
      entityType: "staff_membership",
      entityId: input.userId,
      summary: `Invited ${input.fullName} as ${input.role === "super_admin" ? "Super Admin" : "Admin Assistant"}.`,
      metadata: { email: input.email, role: input.role },
    });
  });
}
