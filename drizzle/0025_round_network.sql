CREATE TYPE "public"."notification_email_state" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."notification_source_type" AS ENUM('enquiry_task', 'vendor_assignment', 'accessory_item', 'fitting_session');--> statement-breakpoint
CREATE TYPE "public"."notification_trigger" AS ENUM('days_7', 'days_3', 'days_1', 'overdue');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_type" "notification_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"trigger" "notification_trigger" NOT NULL,
	"due_date" date NOT NULL,
	"recipient_staff_id" uuid,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text NOT NULL,
	"read_at" timestamp with time zone,
	"email_state" "notification_email_state" DEFAULT 'pending' NOT NULL,
	"email_attempts" integer DEFAULT 0 NOT NULL,
	"email_last_error" text,
	"email_sent_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_staff_id_staff_profiles_id_fk" FOREIGN KEY ("recipient_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_source_trigger_due_uidx" ON "notifications" USING btree ("source_type","source_id","trigger","due_date");--> statement-breakpoint
CREATE INDEX "notifications_org_created_idx" ON "notifications" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_org_unread_idx" ON "notifications" USING btree ("organization_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_email_state_idx" ON "notifications" USING btree ("email_state");--> statement-breakpoint
CREATE POLICY "staff can view organization notifications" ON "notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "notifications"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));