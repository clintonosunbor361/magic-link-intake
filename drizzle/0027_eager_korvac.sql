ALTER TABLE "enquiries" ADD COLUMN "linked_client_id" uuid;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_linked_client_id_clients_id_fk" FOREIGN KEY ("linked_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enquiries_linked_client_idx" ON "enquiries" USING btree ("linked_client_id");