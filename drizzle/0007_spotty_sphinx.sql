CREATE TABLE "consultation_note_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"consultation_note_id" uuid NOT NULL,
	"body" text NOT NULL,
	"source_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone,
	"author_staff_id" uuid NOT NULL,
	"authored_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultation_note_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consultation_note_sources" (
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
ALTER TABLE "consultation_note_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consultation_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"look_id" uuid,
	"source_id" uuid NOT NULL,
	"body" text NOT NULL,
	"occurred_at" timestamp with time zone,
	"created_by_staff_id" uuid NOT NULL,
	"last_edited_by_staff_id" uuid,
	"last_edited_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultation_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consultation_note_revisions" ADD CONSTRAINT "consultation_note_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_note_revisions" ADD CONSTRAINT "consultation_note_revisions_consultation_note_id_consultation_notes_id_fk" FOREIGN KEY ("consultation_note_id") REFERENCES "public"."consultation_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_note_revisions" ADD CONSTRAINT "consultation_note_revisions_source_id_consultation_note_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."consultation_note_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_note_revisions" ADD CONSTRAINT "consultation_note_revisions_author_staff_id_staff_profiles_id_fk" FOREIGN KEY ("author_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_note_sources" ADD CONSTRAINT "consultation_note_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_look_id_looks_id_fk" FOREIGN KEY ("look_id") REFERENCES "public"."looks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_source_id_consultation_note_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."consultation_note_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_created_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_last_edited_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("last_edited_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consultation_note_revisions_note_created_idx" ON "consultation_note_revisions" USING btree ("consultation_note_id","created_at");--> statement-breakpoint
CREATE INDEX "consultation_note_sources_org_sort_idx" ON "consultation_note_sources" USING btree ("organization_id","sort_order");--> statement-breakpoint
CREATE INDEX "consultation_notes_order_idx" ON "consultation_notes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "consultation_notes_look_idx" ON "consultation_notes" USING btree ("look_id");--> statement-breakpoint
CREATE POLICY "staff can view organization consultation note revisions" ON "consultation_note_revisions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "consultation_note_revisions"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization consultation note sources" ON "consultation_note_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "consultation_note_sources"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization consultation notes" ON "consultation_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "consultation_notes"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));