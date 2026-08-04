ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_actor_id_staff_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER POLICY "staff can view organization audit entries" ON "audit_entries" TO authenticated USING (exists (
        select 1 from organization_memberships membership
        where membership.organization_id = "audit_entries"."organization_id"
          and membership.user_id = auth.uid()
          and membership.archived_at is null
          and membership.role = 'super_admin'
      ));