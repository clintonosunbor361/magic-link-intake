CREATE TABLE "production_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_assignment_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "production_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "production_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_assignment_id" uuid NOT NULL,
	"previous_status_id" uuid,
	"new_status_id" uuid NOT NULL,
	"note" text,
	"changed_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "production_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "production_statuses" (
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
ALTER TABLE "production_statuses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"production_status_id" uuid NOT NULL,
	"deadline" date NOT NULL,
	"agreed_vendor_cost_minor" integer,
	"brief_last_exported_at" timestamp with time zone,
	"brief_last_exported_by_staff_id" uuid,
	"assigned_by_staff_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_rating_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_rating_id" uuid NOT NULL,
	"previous_quality" integer NOT NULL,
	"previous_timeliness" integer NOT NULL,
	"previous_communication" integer NOT NULL,
	"new_quality" integer NOT NULL,
	"new_timeliness" integer NOT NULL,
	"new_communication" integer NOT NULL,
	"changed_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_rating_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"quality" integer NOT NULL,
	"timeliness" integer NOT NULL,
	"communication" integer NOT NULL,
	"rated_by_staff_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_specialties" (
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
ALTER TABLE "vendor_specialties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_specialty_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"vendor_specialty_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_specialty_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "timezone" text DEFAULT 'Africa/Lagos' NOT NULL;--> statement-breakpoint
ALTER TABLE "production_notes" ADD CONSTRAINT "production_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_notes" ADD CONSTRAINT "production_notes_vendor_assignment_id_vendor_assignments_id_fk" FOREIGN KEY ("vendor_assignment_id") REFERENCES "public"."vendor_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_notes" ADD CONSTRAINT "production_notes_created_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_status_history" ADD CONSTRAINT "production_status_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_status_history" ADD CONSTRAINT "production_status_history_vendor_assignment_id_vendor_assignments_id_fk" FOREIGN KEY ("vendor_assignment_id") REFERENCES "public"."vendor_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_status_history" ADD CONSTRAINT "production_status_history_previous_status_id_production_statuses_id_fk" FOREIGN KEY ("previous_status_id") REFERENCES "public"."production_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_status_history" ADD CONSTRAINT "production_status_history_new_status_id_production_statuses_id_fk" FOREIGN KEY ("new_status_id") REFERENCES "public"."production_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_status_history" ADD CONSTRAINT "production_status_history_changed_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("changed_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_statuses" ADD CONSTRAINT "production_statuses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_assignments" ADD CONSTRAINT "vendor_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_assignments" ADD CONSTRAINT "vendor_assignments_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_assignments" ADD CONSTRAINT "vendor_assignments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_assignments" ADD CONSTRAINT "vendor_assignments_production_status_id_production_statuses_id_fk" FOREIGN KEY ("production_status_id") REFERENCES "public"."production_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_assignments" ADD CONSTRAINT "vendor_assignments_brief_last_exported_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("brief_last_exported_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_assignments" ADD CONSTRAINT "vendor_assignments_assigned_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("assigned_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_rating_revisions" ADD CONSTRAINT "vendor_rating_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_rating_revisions" ADD CONSTRAINT "vendor_rating_revisions_vendor_rating_id_vendor_ratings_id_fk" FOREIGN KEY ("vendor_rating_id") REFERENCES "public"."vendor_ratings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_rating_revisions" ADD CONSTRAINT "vendor_rating_revisions_changed_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("changed_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_ratings" ADD CONSTRAINT "vendor_ratings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_ratings" ADD CONSTRAINT "vendor_ratings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_ratings" ADD CONSTRAINT "vendor_ratings_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_ratings" ADD CONSTRAINT "vendor_ratings_rated_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("rated_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_specialties" ADD CONSTRAINT "vendor_specialties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_specialty_assignments" ADD CONSTRAINT "vendor_specialty_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_specialty_assignments" ADD CONSTRAINT "vendor_specialty_assignments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_specialty_assignments" ADD CONSTRAINT "vendor_specialty_assignments_vendor_specialty_id_vendor_specialties_id_fk" FOREIGN KEY ("vendor_specialty_id") REFERENCES "public"."vendor_specialties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "production_notes_assignment_idx" ON "production_notes" USING btree ("vendor_assignment_id","created_at");--> statement-breakpoint
CREATE INDEX "production_status_history_assignment_idx" ON "production_status_history" USING btree ("vendor_assignment_id","created_at");--> statement-breakpoint
CREATE INDEX "production_statuses_org_sort_idx" ON "production_statuses" USING btree ("organization_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_assignments_live_item_uidx" ON "vendor_assignments" USING btree ("item_id") WHERE archived_at is null;--> statement-breakpoint
CREATE INDEX "vendor_assignments_org_deadline_idx" ON "vendor_assignments" USING btree ("organization_id","deadline");--> statement-breakpoint
CREATE INDEX "vendor_assignments_vendor_idx" ON "vendor_assignments" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_assignments_status_idx" ON "vendor_assignments" USING btree ("production_status_id");--> statement-breakpoint
CREATE INDEX "vendor_rating_revisions_rating_idx" ON "vendor_rating_revisions" USING btree ("vendor_rating_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_ratings_order_vendor_uidx" ON "vendor_ratings" USING btree ("order_id","vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_ratings_vendor_idx" ON "vendor_ratings" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_specialties_org_sort_idx" ON "vendor_specialties" USING btree ("organization_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_specialty_assignments_vendor_specialty_uidx" ON "vendor_specialty_assignments" USING btree ("vendor_id","vendor_specialty_id");--> statement-breakpoint
CREATE INDEX "vendor_specialty_assignments_specialty_idx" ON "vendor_specialty_assignments" USING btree ("vendor_specialty_id");--> statement-breakpoint
CREATE INDEX "vendors_org_name_idx" ON "vendors" USING btree ("organization_id","name");--> statement-breakpoint
CREATE POLICY "staff can view organization production notes" ON "production_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "production_notes"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization production status history" ON "production_status_history" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "production_status_history"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization production statuses" ON "production_statuses" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "production_statuses"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization vendor assignments" ON "vendor_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "vendor_assignments"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization vendor rating revisions" ON "vendor_rating_revisions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "vendor_rating_revisions"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization vendor ratings" ON "vendor_ratings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "vendor_ratings"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization vendor specialties" ON "vendor_specialties" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "vendor_specialties"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization vendor specialty assignments" ON "vendor_specialty_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "vendor_specialty_assignments"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization vendors" ON "vendors" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "vendors"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));