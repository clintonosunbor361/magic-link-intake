CREATE TYPE "public"."style_direction_batch_delivery_method" AS ENUM('email', 'copy_link');--> statement-breakpoint
CREATE TABLE "style_direction_approval_batch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"style_direction_file_id" uuid NOT NULL,
	"style_direction_file_revision_id" uuid NOT NULL,
	"decision_status" "style_direction_approval_status" DEFAULT 'pending' NOT NULL,
	"decision_comment" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "style_direction_approval_batch_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "style_direction_approval_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by_staff_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"delivery_method" "style_direction_batch_delivery_method",
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "style_direction_approval_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "style_direction_approval_batch_items" ADD CONSTRAINT "style_direction_approval_batch_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_approval_batch_items" ADD CONSTRAINT "style_direction_approval_batch_items_batch_id_style_direction_approval_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."style_direction_approval_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_approval_batch_items" ADD CONSTRAINT "style_direction_approval_batch_items_style_direction_file_id_style_direction_files_id_fk" FOREIGN KEY ("style_direction_file_id") REFERENCES "public"."style_direction_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_approval_batch_items" ADD CONSTRAINT "style_direction_approval_batch_items_style_direction_file_revision_id_style_direction_file_revisions_id_fk" FOREIGN KEY ("style_direction_file_revision_id") REFERENCES "public"."style_direction_file_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_approval_batches" ADD CONSTRAINT "style_direction_approval_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_approval_batches" ADD CONSTRAINT "style_direction_approval_batches_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_direction_approval_batches" ADD CONSTRAINT "style_direction_approval_batches_created_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "style_direction_approval_batch_items_batch_revision_uidx" ON "style_direction_approval_batch_items" USING btree ("batch_id","style_direction_file_revision_id");--> statement-breakpoint
CREATE INDEX "style_direction_approval_batch_items_file_idx" ON "style_direction_approval_batch_items" USING btree ("style_direction_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "style_direction_approval_batches_token_hash_uidx" ON "style_direction_approval_batches" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "style_direction_approval_batches_order_idx" ON "style_direction_approval_batches" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "style_direction_approval_batches_order_pending_idx" ON "style_direction_approval_batches" USING btree ("order_id","completed_at","superseded_at");--> statement-breakpoint
CREATE POLICY "staff can view organization approval batch items" ON "style_direction_approval_batch_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "style_direction_approval_batch_items"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization approval batches" ON "style_direction_approval_batches" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "style_direction_approval_batches"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));