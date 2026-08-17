ALTER TABLE "clients" ADD COLUMN "preferred_contact_channel" text;
ALTER TABLE "clients" ADD COLUMN "event_type" text;
ALTER TABLE "clients" ADD COLUMN "budget_range" text;
ALTER TABLE "clients" ADD COLUMN "brief" text DEFAULT '' NOT NULL;
ALTER TABLE "clients" ADD COLUMN "lead_source" text;
ALTER TABLE "clients" ADD COLUMN "owner_staff_id" uuid;
ALTER TABLE "clients" ADD COLUMN "internal_notes" text;
ALTER TABLE "magic_link_tokens" ADD COLUMN "client_id" uuid;

ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_staff_id_staff_profiles_id_fk"
FOREIGN KEY ("owner_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_client_id_clients_id_fk"
FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
