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
export const clientConfirmationSubjectType = pgEnum("client_confirmation_subject_type", [
  "measurement_profile",
  "order_detail",
  // A Fitting confirmation is sent after the session and asks the client to confirm the outcome —
  // the fit and the agreed alterations — not to accept an appointment.
  "fitting_session",
]);
export const clientConfirmationDecisionStatus = pgEnum("client_confirmation_decision_status", [
  "pending",
  "confirmed",
  "correction_requested",
]);
export const clientConfirmationDeliveryMethod = pgEnum("client_confirmation_delivery_method", ["email", "copy_link"]);
// Only the three staff-driven states are stored. Part Paid and Paid are derived from the balance in
// deriveInvoiceStatus, so a label can never disagree with the money it describes.
export const invoiceLifecycleStatus = pgEnum("invoice_lifecycle_status", ["draft", "sent", "void"]);
// Fixed on purpose, unlike production and accessory statuses: the app reasons about these states
// (reminders fire on scheduled ones, completion warns on open ones, missed is not cancelled), so a
// configurable list would be configurable in name only.
export const fittingSessionStatus = pgEnum("fitting_session_status", [
  "scheduled",
  "completed",
  "missed",
  "cancelled",
]);
// The four deadline sources the spec names. sourceId is polymorphic (same precedent as
// audit_entries.entityId and client_confirmations.subjectId) and so is deliberately not a foreign
// key — the four parents live in four different tables.
export const notificationSourceType = pgEnum("notification_source_type", [
  "enquiry_task",
  "client_task",
  "vendor_assignment",
  "accessory_item",
  "fitting_session",
]);
// The spec's reminder triggers: 7, 3 and 1 days before, plus an overdue alert.
export const notificationTrigger = pgEnum("notification_trigger", ["days_7", "days_3", "days_1", "overdue"]);
// Email state is tracked apart from the notification itself so a Resend failure can never destroy
// the dashboard record — the row exists either way, and only this column changes.
export const notificationEmailState = pgEnum("notification_email_state", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);

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
    // Business dates (production deadlines, urgency bands, notification windows) resolve in this
    // zone so a badge, a filter query, and a viewer-less cron all agree on what "today" is.
    // Instants (created_at, link expiry) stay UTC and are formatted in the viewer's locale.
    timezone: text("timezone").default("Africa/Lagos").notNull(),
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
    preferredContactChannel: text("preferred_contact_channel"),
    eventType: text("event_type"),
    budgetRange: text("budget_range"),
    brief: text("brief").default("").notNull(),
    leadSource: text("lead_source"),
    ownerStaffId: uuid("owner_staff_id").references(() => staffProfiles.id),
    internalNotes: text("internal_notes"),
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
    linkedClientId: uuid("linked_client_id").references(() => clients.id),
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
    index("enquiries_linked_client_idx").on(table.linkedClientId),
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
    // Delivery and completion are one event, not two: the spec only ever says
    // "delivered/completed" of an Order. completionOverrideReason is non-null exactly when a Super
    // Admin completed an Order that still carried a positive client balance.
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByStaffId: uuid("completed_by_staff_id").references(() => staffProfiles.id),
    completionOverrideReason: text("completion_override_reason"),
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

export const clientTasks = pgTable(
  "client_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    clientId: uuid("client_id")
      .references(() => clients.id)
      .notNull(),
    title: text("title").notNull(),
    dueDate: date("due_date").notNull(),
    assignedToStaffId: uuid("assigned_to_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    note: text("note").default("").notNull(),
    createdByStaffId: uuid("created_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    status: enquiryTaskStatus("status").default("open").notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("client_tasks_client_idx").on(table.clientId),
    index("client_tasks_org_due_idx").on(table.organizationId, table.dueDate),
    index("client_tasks_assigned_idx").on(table.assignedToStaffId, table.status),
    pgPolicy("staff can view organization client tasks", {
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
    clientId: uuid("client_id").references(() => clients.id),
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

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    name: text("name").notNull(),
    // Quick-create from the assignment picker supplies name only; phone/email/address are filled
    // in later from the Vendor detail page, so every contact field stays nullable.
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("vendors_org_name_idx").on(table.organizationId, table.name),
    pgPolicy("staff can view organization vendors", {
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

export const vendorSpecialties = pgTable(
  "vendor_specialties",
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
    index("vendor_specialties_org_sort_idx").on(table.organizationId, table.sortOrder),
    pgPolicy("staff can view organization vendor specialties", {
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

// Archiving a specialty removes it from selection but deliberately leaves these rows intact, so a
// Vendor's history doesn't lose the tag it was actually chosen under.
export const vendorSpecialtyAssignments = pgTable(
  "vendor_specialty_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    vendorId: uuid("vendor_id")
      .references(() => vendors.id)
      .notNull(),
    vendorSpecialtyId: uuid("vendor_specialty_id")
      .references(() => vendorSpecialties.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("vendor_specialty_assignments_vendor_specialty_uidx").on(table.vendorId, table.vendorSpecialtyId),
    index("vendor_specialty_assignments_specialty_idx").on(table.vendorSpecialtyId),
    pgPolicy("staff can view organization vendor specialty assignments", {
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

export const productionStatuses = pgTable(
  "production_statuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    // At least one live status must carry this flag; it drives completed-vs-open job counts on the
    // Vendor picker and the M7 rating prompt.
    isCompleted: boolean("is_completed").default(false).notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("production_statuses_org_sort_idx").on(table.organizationId, table.sortOrder),
    pgPolicy("staff can view organization production statuses", {
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

// Reassignment archives the current row and inserts a new one rather than mutating vendor_id, so a
// Vendor's status history, production notes, brief exports, and (from Milestone 6) payment records
// can never silently reattach to the Vendor who replaced them. The partial unique index is what
// enforces "one live Vendor per Item" in Phase 1 — service code does not have to.
export const vendorAssignments = pgTable(
  "vendor_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    itemId: uuid("item_id")
      .references(() => items.id)
      .notNull(),
    vendorId: uuid("vendor_id")
      .references(() => vendors.id)
      .notNull(),
    productionStatusId: uuid("production_status_id")
      .references(() => productionStatuses.id)
      .notNull(),
    deadline: date("deadline").notNull(),
    agreedVendorCostMinor: integer("agreed_vendor_cost_minor"),
    // Export metadata only — Phase 1 stores neither the PDF nor a brief snapshot. "Exported yes/no"
    // is derived from briefLastExportedAt being non-null.
    briefLastExportedAt: timestamp("brief_last_exported_at", { withTimezone: true }),
    briefLastExportedByStaffId: uuid("brief_last_exported_by_staff_id").references(() => staffProfiles.id),
    assignedByStaffId: uuid("assigned_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("vendor_assignments_live_item_uidx")
      .on(table.itemId)
      .where(sql`archived_at is null`),
    index("vendor_assignments_org_deadline_idx").on(table.organizationId, table.deadline),
    index("vendor_assignments_vendor_idx").on(table.vendorId),
    index("vendor_assignments_status_idx").on(table.productionStatusId),
    pgPolicy("staff can view organization vendor assignments", {
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

// previousStatusId is null for the row written when an assignment is first created.
export const productionStatusHistory = pgTable(
  "production_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    vendorAssignmentId: uuid("vendor_assignment_id")
      .references(() => vendorAssignments.id)
      .notNull(),
    previousStatusId: uuid("previous_status_id").references(() => productionStatuses.id),
    newStatusId: uuid("new_status_id")
      .references(() => productionStatuses.id)
      .notNull(),
    note: text("note"),
    changedByStaffId: uuid("changed_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("production_status_history_assignment_idx").on(table.vendorAssignmentId, table.createdAt),
    pgPolicy("staff can view organization production status history", {
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

// Internal only: never rendered on client-facing pages and never included in Vendor Brief PDFs.
export const productionNotes = pgTable(
  "production_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    vendorAssignmentId: uuid("vendor_assignment_id")
      .references(() => vendorAssignments.id)
      .notNull(),
    note: text("note").notNull(),
    createdByStaffId: uuid("created_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("production_notes_assignment_idx").on(table.vendorAssignmentId, table.createdAt),
    pgPolicy("staff can view organization production notes", {
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

// Grain is one rating per (Order, Vendor) — the spec creates prompts "for vendors involved" in a
// completed Order, not per Item, and per-Item ratings would weight a Vendor's average by how many
// garments they happened to make on one job. There is deliberately no stored `overall`: it is the
// mean of the three criteria, computed in summarizeVendorRatings, so it cannot disagree with them.
export const vendorRatings = pgTable(
  "vendor_ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    orderId: uuid("order_id")
      .references(() => orders.id)
      .notNull(),
    vendorId: uuid("vendor_id")
      .references(() => vendors.id)
      .notNull(),
    quality: integer("quality").notNull(),
    timeliness: integer("timeliness").notNull(),
    communication: integer("communication").notNull(),
    ratedByStaffId: uuid("rated_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("vendor_ratings_order_vendor_uidx").on(table.orderId, table.vendorId),
    index("vendor_ratings_vendor_idx").on(table.vendorId),
    pgPolicy("staff can view organization vendor ratings", {
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

// A rating is a judgement, not financial evidence, so it is editable — with an explicit
// previous/new pair per criterion, matching measurement_value_revisions rather than the
// snapshot-only shape used by consultation notes.
export const vendorRatingRevisions = pgTable(
  "vendor_rating_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    vendorRatingId: uuid("vendor_rating_id")
      .references(() => vendorRatings.id)
      .notNull(),
    previousQuality: integer("previous_quality").notNull(),
    previousTimeliness: integer("previous_timeliness").notNull(),
    previousCommunication: integer("previous_communication").notNull(),
    newQuality: integer("new_quality").notNull(),
    newTimeliness: integer("new_timeliness").notNull(),
    newCommunication: integer("new_communication").notNull(),
    changedByStaffId: uuid("changed_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("vendor_rating_revisions_rating_idx").on(table.vendorRatingId, table.createdAt),
    pgPolicy("staff can view organization vendor rating revisions", {
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

// One Invoice per Order in Phase 1, enforced by the unique index on order_id rather than by service
// code. `sequence` is the org-scoped counter; the human-readable number (INV-0001) is formatted from
// it in formatInvoiceNumber and deliberately not stored, so the two cannot drift apart.
//
// There is no archivedAt: an Invoice is immutable evidence under the Milestone 0 lifecycle policy
// and is corrected by voiding, never by archiving or deleting.
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    orderId: uuid("order_id")
      .references(() => orders.id)
      .notNull(),
    sequence: integer("sequence").notNull(),
    status: invoiceLifecycleStatus("status").default("draft").notNull(),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    notes: text("notes").default("").notNull(),
    paymentInstructions: text("payment_instructions").default("").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    createdByStaffId: uuid("created_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    version: integer("version").default(1).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invoices_order_uidx").on(table.orderId),
    uniqueIndex("invoices_org_sequence_uidx").on(table.organizationId, table.sequence),
    pgPolicy("staff can view organization invoices", {
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

// Line amount is quantity × unit price, computed in computeLineAmountMinor rather than stored — the
// same reasoning as vendor_ratings having no `overall` column.
export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    invoiceId: uuid("invoice_id")
      .references(() => invoices.id)
      .notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    index("invoice_line_items_invoice_idx").on(table.invoiceId, table.sortOrder),
    pgPolicy("staff can view organization invoice line items", {
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

// Payments are immutable evidence. "Deleting" one voids it: the row and its history stay, and only
// live payments count toward the balance — which is what ticket 28's "valid payments" means.
export const clientPayments = pgTable(
  "client_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    invoiceId: uuid("invoice_id")
      .references(() => invoices.id)
      .notNull(),
    amountMinor: integer("amount_minor").notNull(),
    paidOn: date("paid_on").notNull(),
    reference: text("reference").default("").notNull(),
    recordedByStaffId: uuid("recorded_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByStaffId: uuid("voided_by_staff_id").references(() => staffProfiles.id),
    voidReason: text("void_reason"),
    version: integer("version").default(1).notNull(),
    ...timestamps,
  },
  (table) => [
    index("client_payments_invoice_idx").on(table.invoiceId, table.paidOn),
    pgPolicy("staff can view organization client payments", {
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

// Vendor payments hang off the assignment, matching where agreed_vendor_cost_minor already lives.
// The optional receipt is a private R2 object reached through a short-lived signed URL; the bytes
// never touch Postgres and the key is never exposed to a client page.
export const vendorPayments = pgTable(
  "vendor_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    vendorAssignmentId: uuid("vendor_assignment_id")
      .references(() => vendorAssignments.id)
      .notNull(),
    amountMinor: integer("amount_minor").notNull(),
    paidOn: date("paid_on").notNull(),
    reference: text("reference").default("").notNull(),
    receiptR2ObjectKey: text("receipt_r2_object_key"),
    receiptMimeType: text("receipt_mime_type"),
    receiptByteSize: integer("receipt_byte_size"),
    recordedByStaffId: uuid("recorded_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByStaffId: uuid("voided_by_staff_id").references(() => staffProfiles.id),
    voidReason: text("void_reason"),
    version: integer("version").default(1).notNull(),
    ...timestamps,
  },
  (table) => [
    index("vendor_payments_assignment_idx").on(table.vendorAssignmentId, table.paidOn),
    pgPolicy("staff can view organization vendor payments", {
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

// Accessory Sourcing is a separate module hanging off the Order. Accessory Items deliberately have
// no vendor assignment, no production status and no money of their own: they never enter the Vendor
// Brief or Production workflows, and anything charged for them is an ordinary Invoice line item.
export const accessoryTypes = pgTable(
  "accessory_types",
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
    index("accessory_types_org_sort_idx").on(table.organizationId, table.sortOrder),
    pgPolicy("staff can view organization accessory types", {
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

// isCompleted marks the delivered/completed end of the list, exactly as production_statuses does.
// It drives the non-blocking outstanding-accessory warning on Order completion.
export const accessoryStatuses = pgTable(
  "accessory_statuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isCompleted: boolean("is_completed").default(false).notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("accessory_statuses_org_sort_idx").on(table.organizationId, table.sortOrder),
    pgPolicy("staff can view organization accessory statuses", {
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

// lookId is nullable: an Accessory belongs to the whole Order or to one Look, the same shape as
// Style Direction Files and Consultation Notes. There is no delivery-date column — the date is
// inherited (the linked Look's date, or the earliest dated live Look for a whole-Order Accessory)
// and computed in resolveAccessoryDeliveryDate, so it cannot go stale when a Look moves.
export const accessoryItems = pgTable(
  "accessory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    orderId: uuid("order_id")
      .references(() => orders.id)
      .notNull(),
    lookId: uuid("look_id").references(() => looks.id),
    accessoryTypeId: uuid("accessory_type_id")
      .references(() => accessoryTypes.id)
      .notNull(),
    // Same shape as items.customLabel: any type may carry a free-text label, which is also how the
    // spec's "Other/custom is allowed" rule is satisfied.
    customLabel: text("custom_label"),
    accessoryStatusId: uuid("accessory_status_id")
      .references(() => accessoryStatuses.id)
      .notNull(),
    notes: text("notes").default("").notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("accessory_items_order_idx").on(table.orderId),
    index("accessory_items_look_idx").on(table.lookId),
    index("accessory_items_status_idx").on(table.accessoryStatusId),
    pgPolicy("staff can view organization accessory items", {
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

// A Fitting Session is one appointment on the Order, optionally naming a Look. Rescheduling edits
// scheduledAt in place so the appointment keeps its identity and its notes; a repeat fitting is a
// new row. clientSummary is the only field the magic link shows — session notes are internal.
export const fittingSessions = pgTable(
  "fitting_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    orderId: uuid("order_id")
      .references(() => orders.id)
      .notNull(),
    lookId: uuid("look_id").references(() => looks.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    location: text("location").default("").notNull(),
    status: fittingSessionStatus("status").default("scheduled").notNull(),
    clientSummary: text("client_summary").default("").notNull(),
    scheduledByStaffId: uuid("scheduled_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    version: integer("version").default(1).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("fitting_sessions_order_idx").on(table.orderId, table.scheduledAt),
    index("fitting_sessions_org_scheduled_idx").on(table.organizationId, table.scheduledAt),
    index("fitting_sessions_status_idx").on(table.status),
    pgPolicy("staff can view organization fitting sessions", {
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

// Internal only — the same rule as production_notes. These never reach a client page and never
// appear in a Vendor Brief. Alterations agreed at a fitting are recorded here in prose.
export const fittingSessionNotes = pgTable(
  "fitting_session_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    fittingSessionId: uuid("fitting_session_id")
      .references(() => fittingSessions.id)
      .notNull(),
    note: text("note").notNull(),
    createdByStaffId: uuid("created_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("fitting_session_notes_session_idx").on(table.fittingSessionId, table.createdAt),
    pgPolicy("staff can view organization fitting session notes", {
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

// Because rescheduling mutates scheduledAt, the previous date would otherwise be lost. Every status
// move and every reschedule appends a row here, so "moved twice then missed" stays legible.
export const fittingSessionHistory = pgTable(
  "fitting_session_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    fittingSessionId: uuid("fitting_session_id")
      .references(() => fittingSessions.id)
      .notNull(),
    previousStatus: fittingSessionStatus("previous_status"),
    newStatus: fittingSessionStatus("new_status").notNull(),
    previousScheduledAt: timestamp("previous_scheduled_at", { withTimezone: true }),
    newScheduledAt: timestamp("new_scheduled_at", { withTimezone: true }).notNull(),
    note: text("note"),
    changedByStaffId: uuid("changed_by_staff_id")
      .references(() => staffProfiles.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("fitting_session_history_session_idx").on(table.fittingSessionId, table.createdAt),
    pgPolicy("staff can view organization fitting session history", {
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

// One row per (source record, trigger, due date). The unique index is the whole idempotency
// mechanism: the cron inserts with onConflictDoNothing, so re-running it — on a retry, a redeploy,
// or twice in one day — cannot produce a duplicate. No "already sent" bookkeeping is needed
// anywhere else.
//
// dueDate is part of the key on purpose. A deadline that moves re-arms its triggers for the new
// date, which matters most for Accessories, whose dates are inherited from a Look and shift
// whenever that Look moves. Keying on (source, trigger) alone would mean a rescheduled deadline
// never warned again.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    sourceType: notificationSourceType("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    trigger: notificationTrigger("trigger").notNull(),
    dueDate: date("due_date").notNull(),
    // The person who can act: the task's assignee, or the Order's primary owner for production,
    // accessory and fitting sources. Only they are emailed; the dashboard shows everything to
    // everyone.
    recipientStaffId: uuid("recipient_staff_id").references(() => staffProfiles.id),
    title: text("title").notNull(),
    body: text("body").default("").notNull(),
    // Where the notification points. Stored rather than derived because the source row may later be
    // archived, and a dead link is worse than a stale one.
    href: text("href").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    emailState: notificationEmailState("email_state").default("pending").notNull(),
    emailAttempts: integer("email_attempts").default(0).notNull(),
    emailLastError: text("email_last_error"),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notifications_source_trigger_due_uidx").on(
      table.sourceType,
      table.sourceId,
      table.trigger,
      table.dueDate,
    ),
    index("notifications_org_created_idx").on(table.organizationId, table.createdAt),
    index("notifications_org_unread_idx").on(table.organizationId, table.readAt),
    index("notifications_email_state_idx").on(table.emailState),
    pgPolicy("staff can view organization notifications", {
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
export type ClientTask = typeof clientTasks.$inferSelect;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type VendorSpecialty = typeof vendorSpecialties.$inferSelect;
export type VendorSpecialtyAssignment = typeof vendorSpecialtyAssignments.$inferSelect;
export type ProductionStatus = typeof productionStatuses.$inferSelect;
export type VendorAssignment = typeof vendorAssignments.$inferSelect;
export type ProductionStatusHistoryEntry = typeof productionStatusHistory.$inferSelect;
export type ProductionNote = typeof productionNotes.$inferSelect;
export type VendorRating = typeof vendorRatings.$inferSelect;
export type VendorRatingRevision = typeof vendorRatingRevisions.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type ClientPayment = typeof clientPayments.$inferSelect;
export type VendorPayment = typeof vendorPayments.$inferSelect;
export type AccessoryType = typeof accessoryTypes.$inferSelect;
export type AccessoryStatus = typeof accessoryStatuses.$inferSelect;
export type AccessoryItem = typeof accessoryItems.$inferSelect;
export type FittingSession = typeof fittingSessions.$inferSelect;
export type FittingSessionNote = typeof fittingSessionNotes.$inferSelect;
export type FittingSessionHistoryEntry = typeof fittingSessionHistory.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
