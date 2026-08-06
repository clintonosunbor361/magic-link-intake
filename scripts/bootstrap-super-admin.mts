import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import {
  auditEntries,
  itemTypes,
  organizationMemberships,
  organizations,
  staffProfiles,
} from "../db/schema";

const DEFAULT_ITEM_TYPES = ["Suit", "Agbada", "Shirt", "Trouser", "Cap", "Shoes", "Other"];

const required = (name: string) => {
  const result = process.env[name];
  if (!result) throw new Error(`${name} is required.`);
  return result;
};

const databaseUrl = required("DATABASE_URL");
const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
const password = required("BOOTSTRAP_ADMIN_PASSWORD");
const fullName = process.env.BOOTSTRAP_ADMIN_NAME ?? "Kuartz Super Admin";
const organizationName = process.env.BOOTSTRAP_ORGANIZATION_NAME ?? "Kuartz by Roti";
const organizationSlug = process.env.BOOTSTRAP_ORGANIZATION_SLUG ?? "kuartz";

if (password.length < 10) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 10 characters.");

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const db = drizzle(sql);
const auth = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

try {
  let [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, organizationSlug))
    .limit(1);
  if (!organization) {
    [organization] = await db
      .insert(organizations)
      .values({ name: organizationName, slug: organizationSlug })
      .returning({ id: organizations.id });
    await db.insert(itemTypes).values(
      DEFAULT_ITEM_TYPES.map((name, index) => ({
        organizationId: organization.id,
        name,
        sortOrder: index,
      })),
    );
  }

  const { data, error } = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("Supabase did not create a user.");

  await db.transaction(async (transaction) => {
    await transaction.insert(staffProfiles).values({ id: data.user.id, fullName, email });
    await transaction.insert(organizationMemberships).values({
      organizationId: organization.id,
      userId: data.user.id,
      role: "super_admin",
    });
    await transaction.insert(auditEntries).values({
      organizationId: organization.id,
      actorId: data.user.id,
      action: "organization.bootstrapped",
      entityType: "organization",
      entityId: organization.id,
      summary: `Created ${organizationName} and its first Super Admin.`,
    });
  });

  process.stdout.write(`Created ${email} for ${organizationName}.\n`);
} finally {
  await sql.end();
}
