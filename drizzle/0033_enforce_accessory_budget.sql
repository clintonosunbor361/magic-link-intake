ALTER TABLE "accessory_items" ADD CONSTRAINT "accessory_items_budget_nonnegative_check" CHECK ("accessory_items"."budget_minor" is null or "accessory_items"."budget_minor" >= 0);
