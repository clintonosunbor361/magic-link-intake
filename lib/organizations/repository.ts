import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { organizations } from "@/db/schema";
import { DEFAULT_ORGANIZATION_TIMEZONE } from "@/lib/domain/business-date";

/**
 * The zone every business date in this organization resolves in. Falls back to the seeded default
 * rather than throwing: a missing timezone should never be the reason a deadline fails to render.
 */
export async function getOrganizationTimezone(organizationId: string): Promise<string> {
  const db = getDatabase();
  const [row] = await db
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return row?.timezone ?? DEFAULT_ORGANIZATION_TIMEZONE;
}
