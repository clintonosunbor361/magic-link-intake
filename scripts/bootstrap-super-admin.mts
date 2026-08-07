import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import {
  auditEntries,
  consultationNoteSources,
  itemTypeMeasurementRequirements,
  itemTypes,
  measurementFieldDefinitions,
  organizationMemberships,
  organizations,
  productionStatuses,
  staffProfiles,
  vendorSpecialties,
} from "../db/schema";

const DEFAULT_ITEM_TYPES = ["Suit", "Agbada", "Shirt", "Trouser", "Cap", "Shoes", "Other"];
const DEFAULT_CONSULTATION_NOTE_SOURCES = [
  "In-person consultation",
  "Phone call",
  "WhatsApp",
  "Email",
  "Sketch reference",
  "Colour reference",
  "Other",
];

const DEFAULT_VENDOR_SPECIALTIES = [
  "Suit",
  "Agbada",
  "Shirt",
  "Trouser",
  "Cap",
  "Shoes",
  "Accessories",
  "Embroidery",
];

// The first entry is where new assignments start; exactly one entry carries completed semantics,
// which is what the "at least one completed status" invariant protects.
const DEFAULT_PRODUCTION_STATUSES: { name: string; isCompleted: boolean }[] = [
  { name: "Not Started", isCompleted: false },
  { name: "In Production", isCompleted: false },
  { name: "Issue / Delay", isCompleted: false },
  { name: "Ready for Fitting", isCompleted: false },
  { name: "Completed", isCompleted: true },
];

const DEFAULT_MEASUREMENT_FIELD_DEFINITIONS: { name: string; unit: string }[] = [
  { name: "Neck", unit: "in" },
  { name: "Shoulder", unit: "in" },
  { name: "Chest", unit: "in" },
  { name: "Waist", unit: "in" },
  { name: "Hip", unit: "in" },
  { name: "Sleeve length", unit: "in" },
  { name: "Bicep", unit: "in" },
  { name: "Wrist", unit: "in" },
  { name: "Shirt length", unit: "in" },
  { name: "Trouser length", unit: "in" },
  { name: "Thigh", unit: "in" },
  { name: "Agbada length", unit: "in" },
  { name: "Head circumference", unit: "in" },
  { name: "Shoe size", unit: "UK" },
];

// Item type name -> required measurement field names. "Other" has no fixed measurement need.
const DEFAULT_ITEM_TYPE_MEASUREMENT_REQUIREMENTS: Record<string, string[]> = {
  Suit: ["Neck", "Shoulder", "Chest", "Waist", "Hip", "Sleeve length", "Bicep", "Wrist", "Trouser length", "Thigh"],
  Agbada: ["Neck", "Shoulder", "Chest", "Sleeve length", "Agbada length"],
  Shirt: ["Neck", "Shoulder", "Chest", "Sleeve length", "Wrist", "Shirt length"],
  Trouser: ["Waist", "Hip", "Trouser length", "Thigh"],
  Cap: ["Head circumference"],
  Shoes: ["Shoe size"],
};

const required = (name: string) => {
  const result = process.env[name];
  if (!result) throw new Error(`${name} is required.`);
  return result;
};

const databaseUrl = required("DATABASE_URL");
const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
const password = required("BOOTSTRAP_ADMIN_PASSWORD");
const fullName = process.env.BOOTSTRAP_ADMIN_NAME ?? "Kuartz Super Admin";
const organizationName = process.env.BOOTSTRAP_ORGANIZATION_NAME ?? "Kuartz by Roti";
const organizationSlug = process.env.BOOTSTRAP_ORGANIZATION_SLUG ?? "kuartz";

if (password.length < 10) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 10 characters.");

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const db = drizzle(sql);
const auth = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

try {
  let [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, organizationSlug))
    .limit(1);
  if (!organization) {
    [organization] = await db
      .insert(organizations)
      .values({ name: organizationName, slug: organizationSlug })
      .returning({ id: organizations.id });
    const insertedItemTypes = await db
      .insert(itemTypes)
      .values(
        DEFAULT_ITEM_TYPES.map((name, index) => ({
          organizationId: organization.id,
          name,
          sortOrder: index,
        })),
      )
      .returning({ id: itemTypes.id, name: itemTypes.name });
    await db.insert(consultationNoteSources).values(
      DEFAULT_CONSULTATION_NOTE_SOURCES.map((name, index) => ({
        organizationId: organization.id,
        name,
        sortOrder: index,
      })),
    );
    await db.insert(vendorSpecialties).values(
      DEFAULT_VENDOR_SPECIALTIES.map((name, index) => ({
        organizationId: organization.id,
        name,
        sortOrder: index,
      })),
    );
    await db.insert(productionStatuses).values(
      DEFAULT_PRODUCTION_STATUSES.map((status, index) => ({
        organizationId: organization.id,
        name: status.name,
        isCompleted: status.isCompleted,
        sortOrder: index,
      })),
    );
    const insertedFieldDefinitions = await db
      .insert(measurementFieldDefinitions)
      .values(
        DEFAULT_MEASUREMENT_FIELD_DEFINITIONS.map((field, index) => ({
          organizationId: organization.id,
          name: field.name,
          unit: field.unit,
          sortOrder: index,
        })),
      )
      .returning({ id: measurementFieldDefinitions.id, name: measurementFieldDefinitions.name });

    const itemTypeIdByName = new Map(insertedItemTypes.map((row) => [row.name, row.id]));
    const fieldDefinitionIdByName = new Map(insertedFieldDefinitions.map((row) => [row.name, row.id]));
    const requirementRows = Object.entries(DEFAULT_ITEM_TYPE_MEASUREMENT_REQUIREMENTS).flatMap(([itemTypeName, fieldNames]) =>
      fieldNames.map((fieldName) => ({
        organizationId: organization.id,
        itemTypeId: itemTypeIdByName.get(itemTypeName)!,
        fieldDefinitionId: fieldDefinitionIdByName.get(fieldName)!,
      })),
    );
    await db.insert(itemTypeMeasurementRequirements).values(requirementRows);
  }

  const { data, error } = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("Supabase did not create a user.");

  await db.transaction(async (transaction) => {
    await transaction.insert(staffProfiles).values({ id: data.user.id, fullName, email });
    await transaction.insert(organizationMemberships).values({
      organizationId: organization.id,
      userId: data.user.id,
      role: "super_admin",
    });
    await transaction.insert(auditEntries).values({
      organizationId: organization.id,
      actorId: data.user.id,
      action: "organization.bootstrapped",
      entityType: "organization",
      entityId: organization.id,
      summary: `Created ${organizationName} and its first Super Admin.`,
    });
  });

  process.stdout.write(`Created ${email} for ${organizationName}.\n`);
} finally {
  await sql.end();
}
