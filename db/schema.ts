import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
// Fixed on purpose (unlike consultation_note_sources/item_types): nothing in the spec suggests
// Kuartz ever adds categories beyond this list, so it isn't given a configurable-list admin screen.
export const styleDirectionFileCategory = pgEnum("style_direction_file_category", [
  "moodboard",
  "sketch",
  "fabric_reference",
  "colour_reference",
  "other",
]);
export const styleDirectionApprovalStatus = pgEnum("style_direction_approval_status", [
  "pending",
  "approved",
  "with_revisions",
  "rejected",
]);
export const styleDirectionBatchDeliveryMethod = pgEnum("style_direction_batch_delivery_method", ["email", "copy_link"]);
export const clientConfirmationSubjectType = pgEnum("client_confirmation_subject_type", ["measurement_profile", "order_detail"]);
export const clientConfirmationDecisionStatus = pgEnum("client_confirmation_decision_status", [
  "pending",
  "confirmed",
  "correction_requested",
]);
export const clientConfirmationDeliveryMethod = pgEnum("client_confirmation_delivery_method", ["email", "copy_link"]);

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

export const consultationNoteSources = pgTable(
  "consultation_note_sources",
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
    index("consultation_note_sources_org_sort_idx").on(table.organizationId, table.sortOrder),
    pgPolicy("staff can view organization consultation note sources", {
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

export const consultationNotes = pgTable(
  "consultation_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    orderId: uuid("order_id")
      .references(() => orders.id)
      .notNull(),
    lookId: uuid("look_id").references(() => looks.id),
    sourceId: uuid("source_id")
      .references(() => consultationNoteSources.id)
      .notNull(),
    body: text("body").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    createdByStaffId: uuid("created_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    lastEditedByStaffId: uuid("last_edited_by_staff_id").references(() => staffProfiles.id),
    lastEditedAt: timestamp("last_edited_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("consultation_notes_order_idx").on(table.orderId),
    index("consultation_notes_look_idx").on(table.lookId),
    pgPolicy("staff can view organization consultation notes", {
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

export const consultationNoteRevisions = pgTable(
  "consultation_note_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    consultationNoteId: uuid("consultation_note_id")
      .references(() => consultationNotes.id)
      .notNull(),
    body: text("body").notNull(),
    sourceId: uuid("source_id")
      .references(() => consultationNoteSources.id)
      .notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    authorStaffId: uuid("author_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    authoredAt: timestamp("authored_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("consultation_note_revisions_note_created_idx").on(table.consultationNoteId, table.createdAt),
    pgPolicy("staff can view organization consultation note revisions", {
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

export const styleDirectionFiles = pgTable(
  "style_direction_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    orderId: uuid("order_id")
      .references(() => orders.id)
      .notNull(),
    lookId: uuid("look_id").references(() => looks.id),
    category: styleDirectionFileCategory("category").notNull(),
    requiresClientApproval: boolean("requires_client_approval").default(false).notNull(),
    // Only meaningful when requiresClientApproval is true; stays null for internal-reference-only files.
    approvalStatus: styleDirectionApprovalStatus("approval_status"),
    currentRevisionId: uuid("current_revision_id").references(
      (): AnyPgColumn => styleDirectionFileRevisions.id,
    ),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("style_direction_files_order_idx").on(table.orderId),
    index("style_direction_files_look_idx").on(table.lookId),
    index("style_direction_files_pending_idx").on(table.orderId, table.requiresClientApproval, table.approvalStatus),
    pgPolicy("staff can view organization style direction files", {
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

export const styleDirectionFileRevisions = pgTable(
  "style_direction_file_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    styleDirectionFileId: uuid("style_direction_file_id")
      .references(() => styleDirectionFiles.id)
      .notNull(),
    revisionNumber: integer("revision_number").notNull(),
    r2ObjectKey: text("r2_object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    uploadedByStaffId: uuid("uploaded_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("style_direction_file_revisions_file_number_uidx").on(table.styleDirectionFileId, table.revisionNumber),
    index("style_direction_file_revisions_file_created_idx").on(table.styleDirectionFileId, table.createdAt),
    pgPolicy("staff can view organization style direction file revisions", {
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

export const styleDirectionApprovalBatches = pgTable(
  "style_direction_approval_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    orderId: uuid("order_id")
      .references(() => orders.id)
      .notNull(),
    tokenHash: text("token_hash").notNull(),
    createdByStaffId: uuid("created_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    deliveryMethod: styleDirectionBatchDeliveryMethod("delivery_method"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("style_direction_approval_batches_token_hash_uidx").on(table.tokenHash),
    index("style_direction_approval_batches_order_idx").on(table.orderId),
    index("style_direction_approval_batches_order_pending_idx").on(table.orderId, table.completedAt, table.supersededAt),
    pgPolicy("staff can view organization approval batches", {
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

export const styleDirectionApprovalBatchItems = pgTable(
  "style_direction_approval_batch_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    batchId: uuid("batch_id")
      .references(() => styleDirectionApprovalBatches.id)
      .notNull(),
    styleDirectionFileId: uuid("style_direction_file_id")
      .references(() => styleDirectionFiles.id)
      .notNull(),
    styleDirectionFileRevisionId: uuid("style_direction_file_revision_id")
      .references(() => styleDirectionFileRevisions.id)
      .notNull(),
    decisionStatus: styleDirectionApprovalStatus("decision_status").default("pending").notNull(),
    decisionComment: text("decision_comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("style_direction_approval_batch_items_batch_revision_uidx").on(
      table.batchId,
      table.styleDirectionFileRevisionId,
    ),
    index("style_direction_approval_batch_items_file_idx").on(table.styleDirectionFileId),
    pgPolicy("staff can view organization approval batch items", {
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

export const measurementFieldDefinitions = pgTable(
  "measurement_field_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("measurement_field_definitions_org_sort_idx").on(table.organizationId, table.sortOrder),
    pgPolicy("staff can view organization measurement field definitions", {
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

export const measurementProfiles = pgTable(
  "measurement_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    clientId: uuid("client_id")
      .references(() => clients.id)
      .notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("measurement_profiles_org_client_uidx").on(table.organizationId, table.clientId),
    pgPolicy("staff can view organization measurement profiles", {
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

export const measurementValues = pgTable(
  "measurement_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    measurementProfileId: uuid("measurement_profile_id")
      .references(() => measurementProfiles.id)
      .notNull(),
    fieldDefinitionId: uuid("field_definition_id")
      .references(() => measurementFieldDefinitions.id)
      .notNull(),
    value: text("value").notNull(),
    createdByStaffId: uuid("created_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    lastEditedByStaffId: uuid("last_edited_by_staff_id").references(() => staffProfiles.id),
    lastEditedAt: timestamp("last_edited_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("measurement_values_profile_field_uidx").on(table.measurementProfileId, table.fieldDefinitionId),
    pgPolicy("staff can view organization measurement values", {
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

export const measurementValueRevisions = pgTable(
  "measurement_value_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    measurementValueId: uuid("measurement_value_id")
      .references(() => measurementValues.id)
      .notNull(),
    fieldDefinitionId: uuid("field_definition_id")
      .references(() => measurementFieldDefinitions.id)
      .notNull(),
    previousValue: text("previous_value"),
    newValue: text("new_value").notNull(),
    changedByStaffId: uuid("changed_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("measurement_value_revisions_value_created_idx").on(table.measurementValueId, table.createdAt),
    pgPolicy("staff can view organization measurement value revisions", {
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

export const measurementProfileAttachments = pgTable(
  "measurement_profile_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    measurementProfileId: uuid("measurement_profile_id")
      .references(() => measurementProfiles.id)
      .notNull(),
    r2ObjectKey: text("r2_object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    uploadedByStaffId: uuid("uploaded_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("measurement_profile_attachments_profile_idx").on(table.measurementProfileId),
    pgPolicy("staff can view organization measurement profile attachments", {
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

export const itemTypeMeasurementRequirements = pgTable(
  "item_type_measurement_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    itemTypeId: uuid("item_type_id")
      .references(() => itemTypes.id)
      .notNull(),
    fieldDefinitionId: uuid("field_definition_id")
      .references(() => measurementFieldDefinitions.id)
      .notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("item_type_measurement_requirements_type_field_uidx").on(table.itemTypeId, table.fieldDefinitionId),
    pgPolicy("staff can view organization item type measurement requirements", {
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

// subjectId is deliberately not a foreign key: it points at either measurement_profiles or
// orders depending on subjectType (same polymorphic precedent as audit_entries.entityId).
export const clientConfirmations = pgTable(
  "client_confirmations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    subjectType: clientConfirmationSubjectType("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdByStaffId: uuid("created_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    decisionStatus: clientConfirmationDecisionStatus("decision_status").default("pending").notNull(),
    decisionComment: text("decision_comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    deliveryMethod: clientConfirmationDeliveryMethod("delivery_method"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("client_confirmations_token_hash_uidx").on(table.tokenHash),
    index("client_confirmations_subject_idx").on(table.subjectType, table.subjectId),
    index("client_confirmations_subject_pending_idx").on(
      table.subjectType,
      table.subjectId,
      table.completedAt,
      table.supersededAt,
    ),
    pgPolicy("staff can view organization client confirmations", {
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
export type ConsultationNoteSource = typeof consultationNoteSources.$inferSelect;
export type ConsultationNote = typeof consultationNotes.$inferSelect;
export type ConsultationNoteRevision = typeof consultationNoteRevisions.$inferSelect;
export type StyleDirectionFile = typeof styleDirectionFiles.$inferSelect;
export type StyleDirectionFileRevision = typeof styleDirectionFileRevisions.$inferSelect;
export type StyleDirectionApprovalBatch = typeof styleDirectionApprovalBatches.$inferSelect;
export type StyleDirectionApprovalBatchItem = typeof styleDirectionApprovalBatchItems.$inferSelect;
export type MeasurementFieldDefinition = typeof measurementFieldDefinitions.$inferSelect;
export type MeasurementProfile = typeof measurementProfiles.$inferSelect;
export type MeasurementValue = typeof measurementValues.$inferSelect;
export type MeasurementValueRevision = typeof measurementValueRevisions.$inferSelect;
export type MeasurementProfileAttachment = typeof measurementProfileAttachments.$inferSelect;
export type ItemTypeMeasurementRequirement = typeof itemTypeMeasurementRequirements.$inferSelect;
export type ClientConfirmation = typeof clientConfirmations.$inferSelect;
export type EnquiryNote = typeof enquiryNotes.$inferSelect;
export type EnquiryTask = typeof enquiryTasks.$inferSelect;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
