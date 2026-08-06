import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { getLocalSupabaseEnvironment } from "@/tests/e2e/local-supabase";

export const E2E_USERS = {
  superAdmin: { email: "roti@kuartz.test", password: "Roti-Operations-2026!" },
  assistant: { email: "teni@kuartz.test", password: "Teni-Operations-2026!" },
  unauthorized: { email: "visitor@kuartz.test", password: "Visitor-Operations-2026!" },
} as const;

export default async function globalSetup() {
  const environment = getLocalSupabaseEnvironment();
  execFileSync("npm", ["run", "db:migrate"], {
    stdio: "inherit",
    env: { ...process.env, ...environment },
  });

  const admin = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const createdUsers = await Promise.all(
    Object.values(E2E_USERS).map(async (user) => {
      const { data, error } = await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error(`Could not create ${user.email}.`);
      return [user.email, data.user.id] as const;
    }),
  );
  const userIds = Object.fromEntries(createdUsers);
  const sql = postgres(environment.DATABASE_URL, { prepare: false, max: 1 });

  try {
    await sql.begin(async (transaction) => {
      await transaction`
        insert into organizations (id, name, slug)
        values
          ('30000000-0000-0000-0000-000000000003', 'Kuartz by Roti', 'kuartz-by-roti'),
          ('40000000-0000-0000-0000-000000000004', 'Separate Atelier', 'separate-atelier')
      `;
      await transaction`
        insert into staff_profiles (id, full_name, email)
        values
          (${userIds[E2E_USERS.superAdmin.email]}, 'Roti Akinola', ${E2E_USERS.superAdmin.email}),
          (${userIds[E2E_USERS.assistant.email]}, 'Teni Adesina', ${E2E_USERS.assistant.email})
      `;
      await transaction`
        insert into organization_memberships (organization_id, user_id, role)
        values
          ('30000000-0000-0000-0000-000000000003', ${userIds[E2E_USERS.superAdmin.email]}, 'super_admin'),
          ('40000000-0000-0000-0000-000000000004', ${userIds[E2E_USERS.assistant.email]}, 'admin_assistant')
      `;
      await transaction`
        insert into audit_entries (organization_id, actor_id, action, entity_type, entity_id, summary)
        values ('30000000-0000-0000-0000-000000000003', ${userIds[E2E_USERS.superAdmin.email]}, 'organization.bootstrapped', 'organization', '30000000-0000-0000-0000-000000000003', 'Created the test organization.')
      `;
      await transaction`
        insert into item_types (organization_id, name, sort_order)
        values
          ('30000000-0000-0000-0000-000000000003', 'Suit', 0),
          ('30000000-0000-0000-0000-000000000003', 'Agbada', 1),
          ('30000000-0000-0000-0000-000000000003', 'Shirt', 2),
          ('30000000-0000-0000-0000-000000000003', 'Trouser', 3),
          ('30000000-0000-0000-0000-000000000003', 'Cap', 4),
          ('30000000-0000-0000-0000-000000000003', 'Shoes', 5),
          ('30000000-0000-0000-0000-000000000003', 'Other', 6)
      `;
      await transaction`
        insert into consultation_note_sources (organization_id, name, sort_order)
        values
          ('30000000-0000-0000-0000-000000000003', 'In-person consultation', 0),
          ('30000000-0000-0000-0000-000000000003', 'Phone call', 1),
          ('30000000-0000-0000-0000-000000000003', 'WhatsApp', 2),
          ('30000000-0000-0000-0000-000000000003', 'Email', 3),
          ('30000000-0000-0000-0000-000000000003', 'Sketch reference', 4),
          ('30000000-0000-0000-0000-000000000003', 'Colour reference', 5),
          ('30000000-0000-0000-0000-000000000003', 'Other', 6)
      `;
      await transaction`
        insert into measurement_field_definitions (organization_id, name, unit, sort_order)
        values
          ('30000000-0000-0000-0000-000000000003', 'Neck', 'in', 0),
          ('30000000-0000-0000-0000-000000000003', 'Shoulder', 'in', 1),
          ('30000000-0000-0000-0000-000000000003', 'Chest', 'in', 2),
          ('30000000-0000-0000-0000-000000000003', 'Waist', 'in', 3),
          ('30000000-0000-0000-0000-000000000003', 'Hip', 'in', 4),
          ('30000000-0000-0000-0000-000000000003', 'Sleeve length', 'in', 5),
          ('30000000-0000-0000-0000-000000000003', 'Bicep', 'in', 6),
          ('30000000-0000-0000-0000-000000000003', 'Wrist', 'in', 7),
          ('30000000-0000-0000-0000-000000000003', 'Shirt length', 'in', 8),
          ('30000000-0000-0000-0000-000000000003', 'Trouser length', 'in', 9),
          ('30000000-0000-0000-0000-000000000003', 'Thigh', 'in', 10),
          ('30000000-0000-0000-0000-000000000003', 'Agbada length', 'in', 11),
          ('30000000-0000-0000-0000-000000000003', 'Head circumference', 'in', 12),
          ('30000000-0000-0000-0000-000000000003', 'Shoe size', 'UK', 13)
      `;
      await transaction`
        insert into item_type_measurement_requirements (organization_id, item_type_id, field_definition_id)
        select '30000000-0000-0000-0000-000000000003', item_types.id, measurement_field_definitions.id
        from (
          values
            ('Suit', 'Neck'), ('Suit', 'Shoulder'), ('Suit', 'Chest'), ('Suit', 'Waist'), ('Suit', 'Hip'),
            ('Suit', 'Sleeve length'), ('Suit', 'Bicep'), ('Suit', 'Wrist'), ('Suit', 'Trouser length'), ('Suit', 'Thigh'),
            ('Agbada', 'Neck'), ('Agbada', 'Shoulder'), ('Agbada', 'Chest'), ('Agbada', 'Sleeve length'), ('Agbada', 'Agbada length'),
            ('Shirt', 'Neck'), ('Shirt', 'Shoulder'), ('Shirt', 'Chest'), ('Shirt', 'Sleeve length'), ('Shirt', 'Wrist'), ('Shirt', 'Shirt length'),
            ('Trouser', 'Waist'), ('Trouser', 'Hip'), ('Trouser', 'Trouser length'), ('Trouser', 'Thigh'),
            ('Cap', 'Head circumference'),
            ('Shoes', 'Shoe size')
        ) as pairs(item_type_name, field_name)
        join item_types on item_types.organization_id = '30000000-0000-0000-0000-000000000003' and item_types.name = pairs.item_type_name
        join measurement_field_definitions on measurement_field_definitions.organization_id = '30000000-0000-0000-0000-000000000003' and measurement_field_definitions.name = pairs.field_name
      `;
    });
  } finally {
    await sql.end();
  }
}
