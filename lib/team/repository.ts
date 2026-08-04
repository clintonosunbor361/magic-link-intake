import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { auditEntries, organizationMemberships, staffProfiles } from "@/db/schema";
import { getDatabase } from "@/db";
import type { StaffRole } from "@/lib/domain/access-control";
import type { StaffRepository } from "@/lib/team/service";

export function createStaffRepository(): StaffRepository {
  const db = getDatabase();
  return {
    async getStaffMember(organizationId, staffMemberId) {
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
            eq(organizationMemberships.userId, staffMemberId),
            isNull(organizationMemberships.archivedAt),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async changeRoleWithAudit(input) {
      await db.transaction(async (transaction) => {
        if (input.previousRole === "super_admin" && input.role !== "super_admin") {
          const activeMemberships = await transaction
            .select({ role: organizationMemberships.role })
            .from(organizationMemberships)
            .where(
              and(
                eq(organizationMemberships.organizationId, input.organizationId),
                isNull(organizationMemberships.archivedAt),
              ),
            )
            .for("update");
          if (activeMemberships.filter(({ role }) => role === "super_admin").length <= 1) {
            throw new Error("The organization must keep at least one Super Admin.");
          }
        }
        const rows = await transaction
          .update(organizationMemberships)
          .set({ role: input.role, version: input.nextVersion, updatedAt: new Date() })
          .where(
            and(
              eq(organizationMemberships.organizationId, input.organizationId),
              eq(organizationMemberships.userId, input.staffMemberId),
              eq(organizationMemberships.version, input.expectedVersion),
            ),
          )
          .returning({ id: organizationMemberships.id });
        if (!rows.length) throw new Error("This Staff Member changed. Reload and try again.");
        await transaction.insert(auditEntries).values({
          organizationId: input.organizationId,
          actorId: input.actorId,
          action: input.action,
          entityType: "staff_membership",
          entityId: input.staffMemberId,
          summary: input.summary,
          metadata: input.metadata,
        });
      });
    },
  };
}

export async function listStaffMembers(organizationId: string) {
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

export async function addInvitedStaffMember(input: {
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
