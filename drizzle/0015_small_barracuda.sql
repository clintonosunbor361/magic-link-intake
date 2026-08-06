CREATE TABLE "item_type_measurement_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_type_id" uuid NOT NULL,
	"field_definition_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_type_measurement_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "item_type_measurement_requirements" ADD CONSTRAINT "item_type_measurement_requirements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_type_measurement_requirements" ADD CONSTRAINT "item_type_measurement_requirements_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_type_measurement_requirements" ADD CONSTRAINT "item_type_measurement_requirements_field_definition_id_measurement_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."measurement_field_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "item_type_measurement_requirements_type_field_uidx" ON "item_type_measurement_requirements" USING btree ("item_type_id","field_definition_id");--> statement-breakpoint
CREATE POLICY "staff can view organization item type measurement requirements" ON "item_type_measurement_requirements" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "item_type_measurement_requirements"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
      ));