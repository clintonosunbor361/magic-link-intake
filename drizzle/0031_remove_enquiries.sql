DELETE FROM "notifications" WHERE "source_type" = 'enquiry_task';--> statement-breakpoint
ALTER TYPE "public"."notification_source_type" RENAME TO "notification_source_type_old";--> statement-breakpoint
CREATE TYPE "public"."notification_source_type" AS ENUM('client_task', 'vendor_assignment', 'accessory_item', 'fitting_session');--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "source_type" TYPE "public"."notification_source_type" USING "source_type"::text::"public"."notification_source_type";--> statement-breakpoint
DROP TYPE "public"."notification_source_type_old";--> statement-breakpoint
ALTER TABLE "magic_link_tokens" DROP COLUMN IF EXISTS "enquiry_id";--> statement-breakpoint
DROP TABLE IF EXISTS "enquiry_tasks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "enquiry_notes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "enquiries" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."enquiry_channel";
