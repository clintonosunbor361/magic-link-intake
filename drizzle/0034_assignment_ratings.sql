-- Custom data-preserving migration. Legacy Order-level ratings retain a null assignment.
ALTER TABLE "vendor_ratings" ADD COLUMN "assignment_id" uuid REFERENCES "vendor_assignments"("id");
--> statement-breakpoint
DROP INDEX "vendor_ratings_order_vendor_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_ratings_assignment_uidx" ON "vendor_ratings" ("assignment_id");
