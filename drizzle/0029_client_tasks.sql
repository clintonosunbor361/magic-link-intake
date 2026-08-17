ALTER TYPE "public"."notification_source_type" ADD VALUE IF NOT EXISTS 'client_task';

CREATE TABLE IF NOT EXISTS "client_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "title" text NOT NULL,
  "due_date" date NOT NULL,
  "assigned_to_staff_id" uuid NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "created_by_staff_id" uuid NOT NULL,
  "status" "enquiry_task_status" DEFAULT 'open' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "client_tasks" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
 ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_organization_id_organizations_id_fk"
 FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_client_id_clients_id_fk"
 FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_assigned_to_staff_id_staff_profiles_id_fk"
 FOREIGN KEY ("assigned_to_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_created_by_staff_id_staff_profiles_id_fk"
 FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "client_tasks_client_idx" ON "client_tasks" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "client_tasks_org_due_idx" ON "client_tasks" USING btree ("organization_id","due_date");
CREATE INDEX IF NOT EXISTS "client_tasks_assigned_idx" ON "client_tasks" USING btree ("assigned_to_staff_id","status");

CREATE POLICY "staff can view organization client tasks" ON "client_tasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
  select 1 from organization_memberships membership
  where membership.organization_id = "client_tasks"."organization_id"
    and membership.user_id = auth.uid()
    and membership.archived_at is null
));
