ALTER TABLE "accessory_items" ADD COLUMN "assigned_to_staff_id" uuid;--> statement-breakpoint
ALTER TABLE "accessory_items" ADD COLUMN "supplier" text;--> statement-breakpoint
ALTER TABLE "accessory_items" ADD COLUMN "budget_minor" integer;--> statement-breakpoint
ALTER TABLE "accessory_items" ADD COLUMN "purchase_date" date;--> statement-breakpoint
ALTER TABLE "accessory_items" ADD CONSTRAINT "accessory_items_assigned_to_staff_id_staff_profiles_id_fk" FOREIGN KEY ("assigned_to_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accessory_items_org_assignee_idx" ON "accessory_items" USING btree ("organization_id", "assigned_to_staff_id");
