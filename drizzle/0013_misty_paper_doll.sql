CREATE TABLE "measurement_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "measurement_field_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "measurement_profile_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"measurement_profile_id" uuid NOT NULL,
	"r2_object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"uploaded_by_staff_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "measurement_profile_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "measurement_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "measurement_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "measurement_value_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"measurement_value_id" uuid NOT NULL,
	"field_definition_id" uuid NOT NULL,
	"previous_value" text,
	"new_value" text NOT NULL,
	"changed_by_staff_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "measurement_value_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "measurement_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"measurement_profile_id" uuid NOT NULL,
	"field_definition_id" uuid NOT NULL,
	"value" text NOT NULL,
	"created_by_staff_id" uuid NOT NULL,
	"last_edited_by_staff_id" uuid,
	"last_edited_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "measurement_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "measurement_field_definitions" ADD CONSTRAINT "measurement_field_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_profile_attachments" ADD CONSTRAINT "measurement_profile_attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_profile_attachments" ADD CONSTRAINT "measurement_profile_attachments_measurement_profile_id_measurement_profiles_id_fk" FOREIGN KEY ("measurement_profile_id") REFERENCES "public"."measurement_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_profile_attachments" ADD CONSTRAINT "measurement_profile_attachments_uploaded_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("uploaded_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_profiles" ADD CONSTRAINT "measurement_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_profiles" ADD CONSTRAINT "measurement_profiles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_value_revisions" ADD CONSTRAINT "measurement_value_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_value_revisions" ADD CONSTRAINT "measurement_value_revisions_measurement_value_id_measurement_values_id_fk" FOREIGN KEY ("measurement_value_id") REFERENCES "public"."measurement_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_value_revisions" ADD CONSTRAINT "measurement_value_revisions_field_definition_id_measurement_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."measurement_field_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_value_revisions" ADD CONSTRAINT "measurement_value_revisions_changed_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("changed_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_values" ADD CONSTRAINT "measurement_values_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_values" ADD CONSTRAINT "measurement_values_measurement_profile_id_measurement_profiles_id_fk" FOREIGN KEY ("measurement_profile_id") REFERENCES "public"."measurement_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_values" ADD CONSTRAINT "measurement_values_field_definition_id_measurement_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."measurement_field_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_values" ADD CONSTRAINT "measurement_values_created_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_values" ADD CONSTRAINT "measurement_values_last_edited_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("last_edited_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "measurement_field_definitions_org_sort_idx" ON "measurement_field_definitions" USING btree ("organization_id","sort_order");--> statement-breakpoint
CREATE INDEX "measurement_profile_attachments_profile_idx" ON "measurement_profile_attachments" USING btree ("measurement_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_profiles_org_client_uidx" ON "measurement_profiles" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "measurement_value_revisions_value_created_idx" ON "measurement_value_revisions" USING btree ("measurement_value_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_values_profile_field_uidx" ON "measurement_values" USING btree ("measurement_profile_id","field_definition_id");--> statement-breakpoint
CREATE POLICY "staff can view organization measurement field definitions" ON "measurement_field_definitions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "measurement_field_definitions"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization measurement profile attachments" ON "measurement_profile_attachments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "measurement_profile_attachments"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization measurement profiles" ON "measurement_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "measurement_profiles"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization measurement value revisions" ON "measurement_value_revisions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "measurement_value_revisions"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization measurement values" ON "measurement_values" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "measurement_values"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));