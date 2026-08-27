-- Preserve every contact as a Client. An explicit converted/linked Client wins; otherwise the
-- enquiry UUID becomes the Client UUID. Contact similarity is deliberately not used for matching.
INSERT INTO "clients" (
  "id",
  "organization_id",
  "full_name",
  "name_normalized",
  "primary_phone",
  "primary_phone_normalized",
  "whatsapp_phone",
  "email",
  "email_normalized",
  "preferred_contact_channel",
  "event_type",
  "budget_range",
  "brief",
  "lead_source",
  "owner_staff_id",
  "internal_notes",
  "version",
  "archived_at",
  "created_at",
  "updated_at"
)
SELECT "enquiry"."id",
  "enquiry"."organization_id",
  "enquiry"."full_name",
  "enquiry"."name_normalized",
  "enquiry"."primary_phone",
  "enquiry"."primary_phone_normalized",
  CASE
    WHEN "enquiry"."whatsapp_same_as_primary" THEN "enquiry"."primary_phone"
    ELSE "enquiry"."whatsapp_phone"
  END,
  "enquiry"."email",
  "enquiry"."email_normalized",
  "enquiry"."preferred_contact_channel",
  "enquiry"."event_type",
  "enquiry"."budget_range",
  "enquiry"."brief",
  "enquiry"."lead_source",
  "enquiry"."owner_staff_id",
  "enquiry"."internal_notes",
  "enquiry"."version",
  "enquiry"."archived_at",
  "enquiry"."created_at",
  "enquiry"."updated_at"
FROM "enquiries" AS "enquiry"
WHERE "enquiry"."converted_client_id" IS NULL
  AND "enquiry"."linked_client_id" IS NULL;--> statement-breakpoint

-- Make the destination explicit for subsequent task, note, and token migration.
UPDATE "enquiries" AS "enquiry"
SET "converted_client_id" = COALESCE("enquiry"."converted_client_id", "enquiry"."linked_client_id", "enquiry"."id"),
  "converted_at" = COALESCE("enquiry"."converted_at", now()),
  "updated_at" = now()
WHERE "enquiry"."converted_client_id" IS NULL;--> statement-breakpoint

-- Older conversions created only identity fields. Fill newly introduced Client context without
-- replacing values that staff may already have edited on the Client.
UPDATE "clients" AS "client"
SET "whatsapp_phone" = COALESCE(
    "client"."whatsapp_phone",
    CASE
      WHEN "enquiry"."whatsapp_same_as_primary" THEN "enquiry"."primary_phone"
      ELSE "enquiry"."whatsapp_phone"
    END
  ),
  "preferred_contact_channel" = COALESCE("client"."preferred_contact_channel", "enquiry"."preferred_contact_channel"),
  "event_type" = COALESCE("client"."event_type", "enquiry"."event_type"),
  "budget_range" = COALESCE("client"."budget_range", "enquiry"."budget_range"),
  "brief" = CASE WHEN "client"."brief" = '' THEN "enquiry"."brief" ELSE "client"."brief" END,
  "lead_source" = COALESCE("client"."lead_source", "enquiry"."lead_source"),
  "owner_staff_id" = COALESCE("client"."owner_staff_id", "enquiry"."owner_staff_id"),
  "internal_notes" = COALESCE("client"."internal_notes", "enquiry"."internal_notes"),
  "updated_at" = GREATEST("client"."updated_at", "enquiry"."updated_at")
FROM "enquiries" AS "enquiry"
WHERE "client"."id" = "enquiry"."converted_client_id"
  AND "client"."organization_id" = "enquiry"."organization_id";--> statement-breakpoint

INSERT INTO "client_tasks" (
  "id",
  "organization_id",
  "client_id",
  "title",
  "due_date",
  "assigned_to_staff_id",
  "note",
  "created_by_staff_id",
  "status",
  "version",
  "archived_at",
  "created_at",
  "updated_at"
)
SELECT "task"."id",
  "task"."organization_id",
  "enquiry"."converted_client_id",
  "task"."title",
  "task"."due_date",
  "task"."assigned_to_staff_id",
  COALESCE("task"."note", ''),
  "task"."created_by_staff_id",
  "task"."status",
  "task"."version",
  "task"."archived_at",
  "task"."created_at",
  "task"."updated_at"
FROM "enquiry_tasks" AS "task"
INNER JOIN "enquiries" AS "enquiry" ON "enquiry"."id" = "task"."enquiry_id"
INNER JOIN "clients" AS "client" ON "client"."id" = "enquiry"."converted_client_id"
  AND "client"."organization_id" = "task"."organization_id";--> statement-breakpoint

-- Phase 1 removes separate follow-up notes. Keep their text and dates in Client internal notes.
WITH "legacy_notes" AS (
  SELECT "enquiry"."converted_client_id" AS "client_id",
    string_agg(
      format(
        '[%s — %s%s] %s',
        "note"."occurred_on",
        "creator"."full_name",
        CASE
          WHEN "note"."next_follow_up_date" IS NULL THEN ''
          ELSE format('; next follow-up %s', "note"."next_follow_up_date")
        END,
        "note"."note"
      ),
      E'\n' ORDER BY "note"."occurred_on", "note"."created_at", "note"."id"
    ) AS "rendered_notes"
  FROM "enquiry_notes" AS "note"
  INNER JOIN "enquiries" AS "enquiry" ON "enquiry"."id" = "note"."enquiry_id"
  INNER JOIN "staff_profiles" AS "creator" ON "creator"."id" = "note"."created_by_staff_id"
  GROUP BY "enquiry"."converted_client_id"
)
UPDATE "clients" AS "client"
SET "internal_notes" = concat_ws(
    E'\n\n',
    NULLIF("client"."internal_notes", ''),
    'Legacy enquiry follow-up notes:' || E'\n' || "legacy_notes"."rendered_notes"
  ),
  "updated_at" = now()
FROM "legacy_notes"
WHERE "client"."id" = "legacy_notes"."client_id";--> statement-breakpoint

UPDATE "magic_link_tokens" AS "token"
SET "client_id" = COALESCE("token"."client_id", "enquiry"."converted_client_id")
FROM "enquiries" AS "enquiry"
INNER JOIN "clients" AS "client" ON "client"."id" = "enquiry"."converted_client_id"
  AND "client"."organization_id" = "enquiry"."organization_id"
WHERE "token"."enquiry_id" = "enquiry"."id";--> statement-breakpoint

-- Abort the transaction before any DROP if a legacy record did not reach its destination.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "enquiries" AS "enquiry"
    LEFT JOIN "clients" AS "client" ON "client"."id" = "enquiry"."converted_client_id"
      AND "client"."organization_id" = "enquiry"."organization_id"
    WHERE "client"."id" IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM "enquiry_tasks" AS "task"
    LEFT JOIN "client_tasks" AS "client_task" ON "client_task"."id" = "task"."id"
    WHERE "client_task"."id" IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM "magic_link_tokens" AS "token"
    WHERE "token"."enquiry_id" IS NOT NULL
      AND "token"."client_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Legacy enquiry migration verification failed; no legacy tables were removed.';
  END IF;
END $$;--> statement-breakpoint

ALTER TYPE "public"."notification_source_type" RENAME TO "notification_source_type_old";--> statement-breakpoint
CREATE TYPE "public"."notification_source_type" AS ENUM('client_task', 'vendor_assignment', 'accessory_item', 'fitting_session');--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "source_type" TYPE "public"."notification_source_type" USING (
  CASE
    WHEN "source_type"::text = 'enquiry_task' THEN 'client_task'
    ELSE "source_type"::text
  END
)::"public"."notification_source_type";--> statement-breakpoint
DROP TYPE "public"."notification_source_type_old";--> statement-breakpoint
ALTER TABLE "magic_link_tokens" DROP COLUMN IF EXISTS "enquiry_id";--> statement-breakpoint
DROP TABLE IF EXISTS "enquiry_tasks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "enquiry_notes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "enquiries" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."enquiry_channel";
