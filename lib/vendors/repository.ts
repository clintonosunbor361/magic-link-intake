import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  productionStatuses,
  vendorAssignments,
  vendorRatings,
  vendors,
  vendorSpecialties,
  vendorSpecialtyAssignments,
} from "@/db/schema";
import { summarizeVendorRatings, type VendorRatingSummary } from "@/lib/vendors/ratings";
import type { VendorRepository } from "@/lib/vendors/service";

export function createVendorRepository(): VendorRepository {
  const db = getDatabase();
  return {
    async createVendor(input) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(vendors)
          .values({
            organizationId: input.organizationId,
            name: input.name,
            phone: input.phone,
            email: input.email,
            address: input.address,
          })
          .returning({ id: vendors.id });

        if (input.specialtyIds.length) {
          await tx.insert(vendorSpecialtyAssignments).values(
            input.specialtyIds.map((vendorSpecialtyId) => ({
              organizationId: input.organizationId,
              vendorId: row.id,
              vendorSpecialtyId,
            })),
          );
        }
        return row;
      });
    },
    async getVendor(organizationId, vendorId) {
      const [row] = await db
        .select({ id: vendors.id, version: vendors.version })
        .from(vendors)
        .where(and(eq(vendors.organizationId, organizationId), eq(vendors.id, vendorId)))
        .limit(1);
      return row ?? null;
    },
    async updateVendor(input) {
      const rows = await db
        .update(vendors)
        .set({
          name: input.name,
          phone: input.phone,
          email: input.email,
          address: input.address,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vendors.organizationId, input.organizationId),
            eq(vendors.id, input.vendorId),
            eq(vendors.version, input.expectedVersion),
          ),
        )
        .returning({ id: vendors.id });
      if (!rows.length) throw new Error("This Vendor changed. Reload and try again.");
    },
    async setArchivedState(input) {
      const rows = await db
        .update(vendors)
        .set({
          archivedAt: input.archived ? new Date() : null,
          version: input.nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vendors.organizationId, input.organizationId),
            eq(vendors.id, input.vendorId),
            eq(vendors.version, input.expectedVersion),
          ),
        )
        .returning({ id: vendors.id });
      if (!rows.length) throw new Error("This Vendor changed. Reload and try again.");
    },
    async replaceSpecialties(input) {
      await db.transaction(async (tx) => {
        await tx
          .delete(vendorSpecialtyAssignments)
          .where(
            and(
              eq(vendorSpecialtyAssignments.organizationId, input.organizationId),
              eq(vendorSpecialtyAssignments.vendorId, input.vendorId),
            ),
          );
        if (input.specialtyIds.length) {
          await tx.insert(vendorSpecialtyAssignments).values(
            input.specialtyIds.map((vendorSpecialtyId) => ({
              organizationId: input.organizationId,
              vendorId: input.vendorId,
              vendorSpecialtyId,
            })),
          );
        }
      });
    },
    async countLiveSpecialties(organizationId, specialtyIds) {
      if (!specialtyIds.length) return 0;
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vendorSpecialties)
        .where(
          and(
            eq(vendorSpecialties.organizationId, organizationId),
            inArray(vendorSpecialties.id, specialtyIds),
            isNull(vendorSpecialties.archivedAt),
          ),
        );
      return row?.count ?? 0;
    },
  };
}

export type VendorListRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  version: number;
  archivedAt: Date | null;
  specialties: { id: string; name: string; archived: boolean }[];
  completedJobs: number;
  openJobs: number;
  lastJobDate: string | null;
  ratingSummary: VendorRatingSummary;
};

/**
 * Backs both the Vendor Directory and the assignment picker. Job counts are computed on read rather
 * than stored as counters on `vendors`: at Phase 1 volume a grouped aggregate is cheap, and counters
 * would need invalidating on every status change, reassignment and archive — three more ways to be
 * quietly wrong.
 *
 * Archived assignments (the residue of a reassignment) still count toward completed jobs and still
 * inform last-job date, because that work really happened. They are excluded from open jobs, since
 * nobody is working on them now.
 */
export async function listVendorsWithStats(
  organizationId: string,
  options: { includeArchived?: boolean; search?: string } = {},
): Promise<VendorListRow[]> {
  const db = getDatabase();

  const conditions = [eq(vendors.organizationId, organizationId)];
  if (!options.includeArchived) conditions.push(isNull(vendors.archivedAt));
  const search = options.search?.trim();
  if (search) {
    conditions.push(sql`(${vendors.name} ilike ${`%${search}%`} or coalesce(${vendors.phone}, '') ilike ${`%${search}%`})`);
  }

  const vendorRows = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      phone: vendors.phone,
      email: vendors.email,
      address: vendors.address,
      version: vendors.version,
      archivedAt: vendors.archivedAt,
    })
    .from(vendors)
    .where(and(...conditions))
    .orderBy(vendors.name);

  if (!vendorRows.length) return [];
  const vendorIds = vendorRows.map((vendor) => vendor.id);

  const [specialtyRows, jobRows, ratingRows] = await Promise.all([
    db
      .select({
        vendorId: vendorSpecialtyAssignments.vendorId,
        specialtyId: vendorSpecialties.id,
        name: vendorSpecialties.name,
        archivedAt: vendorSpecialties.archivedAt,
        sortOrder: vendorSpecialties.sortOrder,
      })
      .from(vendorSpecialtyAssignments)
      .innerJoin(vendorSpecialties, eq(vendorSpecialties.id, vendorSpecialtyAssignments.vendorSpecialtyId))
      .where(
        and(
          eq(vendorSpecialtyAssignments.organizationId, organizationId),
          inArray(vendorSpecialtyAssignments.vendorId, vendorIds),
        ),
      )
      .orderBy(vendorSpecialties.sortOrder),
    db
      .select({
        vendorId: vendorAssignments.vendorId,
        completedJobs: sql<number>`count(*) filter (where ${productionStatuses.isCompleted})::int`,
        openJobs: sql<number>`count(*) filter (where not ${productionStatuses.isCompleted} and ${vendorAssignments.archivedAt} is null)::int`,
        lastJobDate: sql<string | null>`max(${vendorAssignments.deadline})`,
      })
      .from(vendorAssignments)
      .innerJoin(productionStatuses, eq(productionStatuses.id, vendorAssignments.productionStatusId))
      .where(and(eq(vendorAssignments.organizationId, organizationId), inArray(vendorAssignments.vendorId, vendorIds)))
      .groupBy(vendorAssignments.vendorId),
    db
      .select({
        vendorId: vendorRatings.vendorId,
        quality: vendorRatings.quality,
        timeliness: vendorRatings.timeliness,
        communication: vendorRatings.communication,
      })
      .from(vendorRatings)
      .where(
        and(
          eq(vendorRatings.organizationId, organizationId),
          inArray(vendorRatings.vendorId, vendorIds),
          isNull(vendorRatings.archivedAt),
        ),
      ),
  ]);

  const specialtiesByVendor = new Map<string, VendorListRow["specialties"]>();
  for (const row of specialtyRows) {
    const list = specialtiesByVendor.get(row.vendorId) ?? [];
    list.push({ id: row.specialtyId, name: row.name, archived: row.archivedAt !== null });
    specialtiesByVendor.set(row.vendorId, list);
  }

  const jobsByVendor = new Map(jobRows.map((row) => [row.vendorId, row]));

  const ratingsByVendor = new Map<string, { quality: number; timeliness: number; communication: number }[]>();
  for (const row of ratingRows) {
    const list = ratingsByVendor.get(row.vendorId) ?? [];
    list.push({ quality: row.quality, timeliness: row.timeliness, communication: row.communication });
    ratingsByVendor.set(row.vendorId, list);
  }

  return vendorRows.map((vendor) => {
    const jobs = jobsByVendor.get(vendor.id);
    return {
      ...vendor,
      specialties: specialtiesByVendor.get(vendor.id) ?? [],
      completedJobs: jobs?.completedJobs ?? 0,
      openJobs: jobs?.openJobs ?? 0,
      lastJobDate: jobs?.lastJobDate ?? null,
      // Empty today: the ratings table exists but the Milestone 7 prompt flow that fills it does
      // not, so this reports "unrated" rather than a misleading 0.0.
      ratingSummary: summarizeVendorRatings(ratingsByVendor.get(vendor.id) ?? []),
    };
  });
}

export async function getVendorWithStats(organizationId: string, vendorId: string): Promise<VendorListRow | null> {
  const rows = await listVendorsWithStats(organizationId, { includeArchived: true });
  return rows.find((vendor) => vendor.id === vendorId) ?? null;
}
