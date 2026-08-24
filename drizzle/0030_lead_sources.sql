CREATE TABLE IF NOT EXISTS "lead_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "lead_sources" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
 ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_organization_id_organizations_id_fk"
 FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "lead_sources_org_sort_idx" ON "lead_sources" USING btree ("organization_id","sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "lead_sources_org_name_uidx" ON "lead_sources" USING btree ("organization_id","name");

CREATE POLICY "staff can view organization lead sources" ON "lead_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
  select 1 from organization_memberships membership
  where membership.organization_id = "lead_sources"."organization_id"
    and membership.user_id = auth.uid()
    and membership.archived_at is null
));

INSERT INTO "lead_sources" ("organization_id", "name", "sort_order")
SELECT organization_id, name, sort_order
FROM (
  SELECT
    organizations.id AS organization_id,
    defaults.name,
    defaults.sort_order
  FROM organizations
  CROSS JOIN (
    VALUES
      ('Instagram', 0),
      ('Referral', 1),
      ('WhatsApp', 2),
      ('Website', 3),
      ('Walk-in', 4),
      ('Repeat client', 5),
      ('Event/vendor referral', 6),
      ('Other', 7)
  ) AS defaults(name, sort_order)
) seeded
ON CONFLICT ("organization_id", "name") DO NOTHING;
