import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const staffRole = pgEnum("staff_role", ["super_admin", "admin_assistant"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organizations_slug_uidx").on(table.slug),
    pgPolicy("members can view their organization", {
      for: "select",
      to: "authenticated",
      using: sql`exists (
        select 1 from organization_memberships membership
        where membership.organization_id = ${table.id}
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      )`,
    }),
  ],
).enableRLS();

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: uuid("id").primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("staff_profiles_email_uidx").on(table.email),
    pgPolicy("staff can view their profile", {
      for: "select",
      to: "authenticated",
      using: sql`${table.id} = auth.uid()`,
    }),
    pgPolicy("staff can update their profile", {
      for: "update",
      to: "authenticated",
      using: sql`${table.id} = auth.uid()`,
      withCheck: sql`${table.id} = auth.uid()`,
    }),
  ],
).enableRLS();

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => staffProfiles.id)
      .notNull(),
    role: staffRole("role").notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_memberships_org_user_uidx").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_memberships_user_idx").on(table.userId),
    pgPolicy("staff can view their memberships", {
      for: "select",
      to: "authenticated",
      using: sql`${table.userId} = auth.uid()`,
    }),
  ],
).enableRLS();

export const auditEntries = pgTable(
  "audit_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_entries_org_created_idx").on(table.organizationId, table.createdAt),
    index("audit_entries_entity_idx").on(table.entityType, table.entityId),
    pgPolicy("staff can view organization audit entries", {
      for: "select",
      to: "authenticated",
      using: sql`exists (
        select 1 from organization_memberships membership
        where membership.organization_id = ${table.organizationId}
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      )`,
    }),
  ],
).enableRLS();

export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type AuditEntry = typeof auditEntries.$inferSelect;
