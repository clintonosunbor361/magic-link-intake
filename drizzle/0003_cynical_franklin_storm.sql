CREATE TYPE "public"."enquiry_channel" AS ENUM('external_form', 'internal_staff');--> statement-breakpoint
CREATE TYPE "public"."enquiry_task_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"primary_phone" text NOT NULL,
	"primary_phone_normalized" text NOT NULL,
	"whatsapp_phone" text,
	"email" text,
	"email_normalized" text,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"channel" "enquiry_channel" NOT NULL,
	"full_name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"primary_phone" text NOT NULL,
	"primary_phone_normalized" text NOT NULL,
	"whatsapp_same_as_primary" boolean DEFAULT true NOT NULL,
	"whatsapp_phone" text,
	"email" text,
	"email_normalized" text,
	"preferred_contact_channel" text NOT NULL,
	"event_type" text NOT NULL,
	"budget_range" text,
	"brief" text DEFAULT '' NOT NULL,
	"lead_source" text,
	"owner_staff_id" uuid,
	"internal_notes" text,
	"converted_at" timestamp with time zone,
	"converted_client_id" uuid,
	"converted_order_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enquiries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "enquiry_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"note" text NOT NULL,
	"occurred_on" date NOT NULL,
	"next_follow_up_date" date,
	"created_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enquiry_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "enquiry_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_date" date NOT NULL,
	"assigned_to_staff_id" uuid NOT NULL,
	"status" "enquiry_task_status" DEFAULT 'open' NOT NULL,
	"note" text DEFAULT '',
	"created_by_staff_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enquiry_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "looks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"name" text NOT NULL,
	"look_date" date,
	"notes" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "looks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"generated_by_staff_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"enquiry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"event_type" text NOT NULL,
	"final_agreed_price_minor" integer NOT NULL,
	"primary_owner_staff_id" uuid NOT NULL,
	"ff_discount" boolean DEFAULT false NOT NULL,
	"ff_discount_amount_minor" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_owner_staff_id_staff_profiles_id_fk" FOREIGN KEY ("owner_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_converted_client_id_clients_id_fk" FOREIGN KEY ("converted_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_converted_order_id_orders_id_fk" FOREIGN KEY ("converted_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_notes" ADD CONSTRAINT "enquiry_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_notes" ADD CONSTRAINT "enquiry_notes_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_notes" ADD CONSTRAINT "enquiry_notes_created_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_tasks" ADD CONSTRAINT "enquiry_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_tasks" ADD CONSTRAINT "enquiry_tasks_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_tasks" ADD CONSTRAINT "enquiry_tasks_assigned_to_staff_id_staff_profiles_id_fk" FOREIGN KEY ("assigned_to_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_tasks" ADD CONSTRAINT "enquiry_tasks_created_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "looks" ADD CONSTRAINT "looks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "looks" ADD CONSTRAINT "looks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_generated_by_staff_id_staff_profiles_id_fk" FOREIGN KEY ("generated_by_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_primary_owner_staff_id_staff_profiles_id_fk" FOREIGN KEY ("primary_owner_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_org_created_idx" ON "clients" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "clients_org_phone_idx" ON "clients" USING btree ("organization_id","primary_phone_normalized");--> statement-breakpoint
CREATE INDEX "clients_org_email_idx" ON "clients" USING btree ("organization_id","email_normalized");--> statement-breakpoint
CREATE INDEX "clients_org_name_idx" ON "clients" USING btree ("organization_id","name_normalized");--> statement-breakpoint
CREATE INDEX "enquiries_org_created_idx" ON "enquiries" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "enquiries_org_phone_idx" ON "enquiries" USING btree ("organization_id","primary_phone_normalized");--> statement-breakpoint
CREATE INDEX "enquiries_org_email_idx" ON "enquiries" USING btree ("organization_id","email_normalized");--> statement-breakpoint
CREATE INDEX "enquiries_org_name_idx" ON "enquiries" USING btree ("organization_id","name_normalized");--> statement-breakpoint
CREATE INDEX "enquiry_notes_enquiry_created_idx" ON "enquiry_notes" USING btree ("enquiry_id","created_at");--> statement-breakpoint
CREATE INDEX "enquiry_tasks_enquiry_idx" ON "enquiry_tasks" USING btree ("enquiry_id");--> statement-breakpoint
CREATE INDEX "enquiry_tasks_org_due_idx" ON "enquiry_tasks" USING btree ("organization_id","due_date");--> statement-breakpoint
CREATE INDEX "enquiry_tasks_assigned_idx" ON "enquiry_tasks" USING btree ("assigned_to_staff_id","status");--> statement-breakpoint
CREATE INDEX "looks_order_idx" ON "looks" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_link_tokens_token_hash_uidx" ON "magic_link_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "magic_link_tokens_org_created_idx" ON "magic_link_tokens" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_client_idx" ON "orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "orders_org_created_idx" ON "orders" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE POLICY "staff can view organization clients" ON "clients" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "clients"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization enquiries" ON "enquiries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "enquiries"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization enquiry notes" ON "enquiry_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "enquiry_notes"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization enquiry tasks" ON "enquiry_tasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "enquiry_tasks"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization looks" ON "looks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "looks"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization magic link tokens" ON "magic_link_tokens" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "magic_link_tokens"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));--> statement-breakpoint
CREATE POLICY "staff can view organization orders" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "orders"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));