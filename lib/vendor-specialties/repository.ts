import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import { vendorSpecialties } from "@/db/schema";
import type { VendorSpecialtyRepository } from "@/lib/vendor-specialties/service";

export function createVendorSpecialtyRepository(): VendorSpecialtyRepository {
  const db = getDatabase();
  return {
    async createVendorSpecialty(input) {
      const [row] = await db
        .insert(vendorSpecialties)
        .values({
          organizationId: input.organizationId,
          name: input.name,
          sortOrder: input.sortOrder,
        })
        .returning({ id: vendorSpecialties.id });
      return row;
    },
    async getVendorSpecialty(organizationId, specialtyId) {
      const [row] = await db
        .select({ id: vendorSpecialties.id, version: vendorSpecialties.version })
        .from(vendorSpecialties)
        .where(and(eq(vendorSpecialties.organizationId, organizationId), eq(vendorSpecialties.id, specialtyId)))
        .limit(1);
      return row ?? null;
    },
    async setArchivedState(input) {
      const rows = await db
        .update(vendorSpecialties)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vendorSpecialties.organizationId, input.organizationId),
            eq(vendorSpecialties.id, input.specialtyId),
            eq(vendorSpecialties.version, input.expectedVersion),
          ),
        )
        .returning({ id: vendorSpecialties.id });
      if (!rows.length) throw new Error("This specialty changed. Reload and try again.");
    },
  };
}

export async function listVendorSpecialties(
  organizationId: string,
  options: { includeArchived?: boolean } = {},
) {
  const db = getDatabase();
  const conditions = [eq(vendorSpecialties.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(vendorSpecialties.archivedAt));

  return db
    .select({
      id: vendorSpecialties.id,
      name: vendorSpecialties.name,
      sortOrder: vendorSpecialties.sortOrder,
      version: vendorSpecialties.version,
      archivedAt: vendorSpecialties.archivedAt,
    })
    .from(vendorSpecialties)
    .where(and(...conditions))
    .orderBy(vendorSpecialties.sortOrder);
}
