CREATE TYPE "public"."client_confirmation_decision_status" AS ENUM('pending', 'confirmed', 'correction_requested');--> statement-breakpoint
CREATE TYPE "public"."client_confirmation_delivery_method" AS ENUM('email', 'copy_link');--> statement-breakpoint
CREATE TYPE "public"."client_confirmation_subject_type" AS ENUM('measurement_profile', 'order_detail');--> statement-breakpoint
CREATE TABLE "client_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject_type" "client_confirmation_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by_staff_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"decision_status" "client_confirmation_decision_status" DEFAULT 'pending' NOT NULL,
	"decision_comment" text,
	"decided_at" timestamp with time zone,
	"delivery_method" "client_confirmation_delivery_method",
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_confirmations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_confirmations" ADD CONSTRAINT "client_confirmations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_confirmations" ADD CONSTRAINT "client_confirmations_created_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_confirmations_token_hash_uidx" ON "client_confirmations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "client_confirmations_subject_idx" ON "client_confirmations" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "client_confirmations_subject_pending_idx" ON "client_confirmations" USING btree ("subject_type","subject_id","completed_at","superseded_at");--> statement-breakpoint
CREATE POLICY "staff can view organization client confirmations" ON "client_confirmations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "client_confirmations"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));