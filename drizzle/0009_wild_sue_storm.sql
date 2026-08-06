CREATE TYPE "public"."style_direction_approval_status" AS ENUM('pending', 'approved', 'with_revisions', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."style_direction_file_category" AS ENUM('moodboard', 'sketch', 'fabric_reference', 'colour_reference', 'other');--> statement-breakpoint
CREATE TABLE "style_direction_file_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"style_direction_file_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"r2_object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"uploaded_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "style_direction_file_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "style_direction_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"look_id" uuid,
	"category" "style_direction_file_category" NOT NULL,
	"requires_client_approval" boolean DEFAULT false NOT NULL,
	"approval_status" "style_direction_approval_status",
	"current_revision_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "style_direction_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "style_direction_file_revisions" ADD CONSTRAINT "style_direction_file_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_file_revisions" ADD CONSTRAINT "style_direction_file_revisions_style_direction_file_id_style_direction_files_id_fk" FOREIGN KEY ("style_direction_file_id") REFERENCES "public"."style_direction_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_file_revisions" ADD CONSTRAINT "style_direction_file_revisions_uploaded_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("uploaded_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_files" ADD CONSTRAINT "style_direction_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_files" ADD CONSTRAINT "style_direction_files_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_files" ADD CONSTRAINT "style_direction_files_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_files" ADD CONSTRAINT "style_direction_files_current_revision_id_style_direction_file_revisions_id_fk" FOREIGN KEY ("current_revision_id") REFERENCES "public"."style_direction_file_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "style_direction_file_revisions_file_number_uidx" ON "style_direction_file_revisions" USING btree ("style_direction_file_id","revision_number");--> statement-breakpoint
CREATE INDEX "style_direction_file_revisions_file_created_idx" ON "style_direction_file_revisions" USING btree ("style_direction_file_id","created_at");--> statement-breakpoint
CREATE INDEX "style_direction_files_order_idx" ON "style_direction_files" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "style_direction_files_look_idx" ON "style_direction_files" USING btree ("look_id");--> statement-breakpoint
CREATE INDEX "style_direction_files_pending_idx" ON "style_direction_files" USING btree ("order_id","requires_client_approval","approval_status");--> statement-breakpoint
CREATE POLICY "staff can view organization style direction file revisions" ON "style_direction_file_revisions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "style_direction_file_revisions"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization style direction files" ON "style_direction_files" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "style_direction_files"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));