CREATE TYPE "public"."fitting_session_status" AS ENUM('scheduled', 'completed', 'missed', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."client_confirmation_subject_type" ADD VALUE 'fitting_session';--> statement-breakpoint
CREATE TABLE "accessory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"look_id" uuid,
	"accessory_type_id" uuid NOT NULL,
	"custom_label" text,
	"accessory_status_id" uuid NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accessory_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accessory_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accessory_statuses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accessory_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accessory_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fitting_session_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"fitting_session_id" uuid NOT NULL,
	"previous_status" "fitting_session_status",
	"new_status" "fitting_session_status" NOT NULL,
	"previous_scheduled_at" timestamp with time zone,
	"new_scheduled_at" timestamp with time zone NOT NULL,
	"note" text,
	"changed_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fitting_session_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fitting_session_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"fitting_session_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fitting_session_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fitting_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"look_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"status" "fitting_session_status" DEFAULT 'scheduled' NOT NULL,
	"client_summary" text DEFAULT '' NOT NULL,
	"scheduled_by_staff_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fitting_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accessory_items" ADD CONSTRAINT "accessory_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessory_items" ADD CONSTRAINT "accessory_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessory_items" ADD CONSTRAINT "accessory_items_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessory_items" ADD CONSTRAINT "accessory_items_accessory_type_id_accessory_types_id_fk" FOREIGN KEY ("accessory_type_id") REFERENCES "public"."accessory_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessory_items" ADD CONSTRAINT "accessory_items_accessory_status_id_accessory_statuses_id_fk" FOREIGN KEY ("accessory_status_id") REFERENCES "public"."accessory_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessory_statuses" ADD CONSTRAINT "accessory_statuses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessory_types" ADD CONSTRAINT "accessory_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_session_history" ADD CONSTRAINT "fitting_session_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_session_history" ADD CONSTRAINT "fitting_session_history_fitting_session_id_fitting_sessions_id_fk" FOREIGN KEY ("fitting_session_id") REFERENCES "public"."fitting_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_session_history" ADD CONSTRAINT "fitting_session_history_changed_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("changed_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_session_notes" ADD CONSTRAINT "fitting_session_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_session_notes" ADD CONSTRAINT "fitting_session_notes_fitting_session_id_fitting_sessions_id_fk" FOREIGN KEY ("fitting_session_id") REFERENCES "public"."fitting_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_session_notes" ADD CONSTRAINT "fitting_session_notes_created_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_sessions" ADD CONSTRAINT "fitting_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_sessions" ADD CONSTRAINT "fitting_sessions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_sessions" ADD CONSTRAINT "fitting_sessions_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitting_sessions" ADD CONSTRAINT "fitting_sessions_scheduled_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("scheduled_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accessory_items_order_idx" ON "accessory_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "accessory_items_look_idx" ON "accessory_items" USING btree ("look_id");--> statement-breakpoint
CREATE INDEX "accessory_items_status_idx" ON "accessory_items" USING btree ("accessory_status_id");--> statement-breakpoint
CREATE INDEX "accessory_statuses_org_sort_idx" ON "accessory_statuses" USING btree ("organization_id","sort_order");--> statement-breakpoint
CREATE INDEX "accessory_types_org_sort_idx" ON "accessory_types" USING btree ("organization_id","sort_order");--> statement-breakpoint
CREATE INDEX "fitting_session_history_session_idx" ON "fitting_session_history" USING btree ("fitting_session_id","created_at");--> statement-breakpoint
CREATE INDEX "fitting_session_notes_session_idx" ON "fitting_session_notes" USING btree ("fitting_session_id","created_at");--> statement-breakpoint
CREATE INDEX "fitting_sessions_order_idx" ON "fitting_sessions" USING btree ("order_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "fitting_sessions_org_scheduled_idx" ON "fitting_sessions" USING btree ("organization_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "fitting_sessions_status_idx" ON "fitting_sessions" USING btree ("status");--> statement-breakpoint
CREATE POLICY "staff can view organization accessory items" ON "accessory_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "accessory_items"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization accessory statuses" ON "accessory_statuses" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "accessory_statuses"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization accessory types" ON "accessory_types" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "accessory_types"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization fitting session history" ON "fitting_session_history" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "fitting_session_history"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization fitting session notes" ON "fitting_session_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "fitting_session_notes"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization fitting sessions" ON "fitting_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "fitting_sessions"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));