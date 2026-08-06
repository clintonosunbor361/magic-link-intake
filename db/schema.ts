import { sql } from "drizzle-orm";
import {
  boolean,
  date,
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
export const enquiryChannel = pgEnum("enquiry_channel", ["external_form", "internal_staff"]);
export const enquiryTaskStatus = pgEnum("enquiry_task_status", ["open", "done"]);

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
    actorId: uuid("actor_id").references(() => staffProfiles.id),
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
          and membership.role = 'super_admin'
      )`,
    }),
  ],
).enableRLS();

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    fullName: text("full_name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    primaryPhone: text("primary_phone").notNull(),
    primaryPhoneNormalized: text("primary_phone_normalized").notNull(),
    whatsappPhone: text("whatsapp_phone"),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("clients_org_created_idx").on(table.organizationId, table.createdAt),
    index("clients_org_phone_idx").on(table.organizationId, table.primaryPhoneNormalized),
    index("clients_org_email_idx").on(table.organizationId, table.emailNormalized),
    index("clients_org_name_idx").on(table.organizationId, table.nameNormalized),
    pgPolicy("staff can view organization clients", {
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

export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    channel: enquiryChannel("channel").notNull(),
    fullName: text("full_name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    primaryPhone: text("primary_phone").notNull(),
    primaryPhoneNormalized: text("primary_phone_normalized").notNull(),
    whatsappSameAsPrimary: boolean("whatsapp_same_as_primary").default(true).notNull(),
    whatsappPhone: text("whatsapp_phone"),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    preferredContactChannel: text("preferred_contact_channel").notNull(),
    eventType: text("event_type").notNull(),
    budgetRange: text("budget_range"),
    brief: text("brief").default("").notNull(),
    leadSource: text("lead_source"),
    ownerStaffId: uuid("owner_staff_id").references(() => staffProfiles.id),
    internalNotes: text("internal_notes"),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    convertedClientId: uuid("converted_client_id").references(() => clients.id),
    convertedOrderId: uuid("converted_order_id").references(() => orders.id),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("enquiries_org_created_idx").on(table.organizationId, table.createdAt),
    index("enquiries_org_phone_idx").on(table.organizationId, table.primaryPhoneNormalized),
    index("enquiries_org_email_idx").on(table.organizationId, table.emailNormalized),
    index("enquiries_org_name_idx").on(table.organizationId, table.nameNormalized),
    pgPolicy("staff can view organization enquiries", {
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

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    clientId: uuid("client_id")
      .references(() => clients.id)
      .notNull(),
    title: text("title").notNull(),
    eventType: text("event_type").notNull(),
    finalAgreedPriceMinor: integer("final_agreed_price_minor").notNull(),
    primaryOwnerStaffId: uuid("primary_owner_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    ffDiscount: boolean("ff_discount").default(false).notNull(),
    ffDiscountAmountMinor: integer("ff_discount_amount_minor"),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("orders_client_idx").on(table.clientId),
    index("orders_org_created_idx").on(table.organizationId, table.createdAt),
    pgPolicy("staff can view organization orders", {
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

export const looks = pgTable(
  "looks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    orderId: uuid("order_id")
      .references(() => orders.id)
      .notNull(),
    name: text("name").notNull(),
    lookDate: date("look_date"),
    notes: text("notes").default("").notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("looks_order_idx").on(table.orderId),
    pgPolicy("staff can view organization looks", {
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

export const itemTypes = pgTable(
  "item_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("item_types_org_sort_idx").on(table.organizationId, table.sortOrder),
    pgPolicy("staff can view organization item types", {
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

export const items = pgTable(
  "items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    lookId: uuid("look_id")
      .references(() => looks.id)
      .notNull(),
    itemTypeId: uuid("item_type_id")
      .references(() => itemTypes.id)
      .notNull(),
    customLabel: text("custom_label"),
    quantity: integer("quantity").default(1).notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("items_look_idx").on(table.lookId),
    index("items_org_created_idx").on(table.organizationId, table.createdAt),
    pgPolicy("staff can view organization items", {
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

export const enquiryNotes = pgTable(
  "enquiry_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    enquiryId: uuid("enquiry_id")
      .references(() => enquiries.id)
      .notNull(),
    note: text("note").notNull(),
    occurredOn: date("occurred_on").notNull(),
    nextFollowUpDate: date("next_follow_up_date"),
    createdByStaffId: uuid("created_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("enquiry_notes_enquiry_created_idx").on(table.enquiryId, table.createdAt),
    pgPolicy("staff can view organization enquiry notes", {
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

export const enquiryTasks = pgTable(
  "enquiry_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    enquiryId: uuid("enquiry_id")
      .references(() => enquiries.id)
      .notNull(),
    title: text("title").notNull(),
    dueDate: date("due_date").notNull(),
    assignedToStaffId: uuid("assigned_to_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    status: enquiryTaskStatus("status").default("open").notNull(),
    note: text("note").default(""),
    createdByStaffId: uuid("created_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("enquiry_tasks_enquiry_idx").on(table.enquiryId),
    index("enquiry_tasks_org_due_idx").on(table.organizationId, table.dueDate),
    index("enquiry_tasks_assigned_idx").on(table.assignedToStaffId, table.status),
    pgPolicy("staff can view organization enquiry tasks", {
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

export const magicLinkTokens = pgTable(
  "magic_link_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    generatedByStaffId: uuid("generated_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    enquiryId: uuid("enquiry_id").references(() => enquiries.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("magic_link_tokens_token_hash_uidx").on(table.tokenHash),
    index("magic_link_tokens_org_created_idx").on(table.organizationId, table.createdAt),
    pgPolicy("staff can view organization magic link tokens", {
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
export type Client = typeof clients.$inferSelect;
export type Enquiry = typeof enquiries.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Look = typeof looks.$inferSelect;
export type ItemType = typeof itemTypes.$inferSelect;
export type Item = typeof items.$inferSelect;
export type EnquiryNote = typeof enquiryNotes.$inferSelect;
export type EnquiryTask = typeof enquiryTasks.$inferSelect;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
