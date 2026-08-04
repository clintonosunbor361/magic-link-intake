import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAdminConfig } from "@/lib/supabase/config";

export function createSupabaseAdminClient() {
  const config = requireSupabaseAdminConfig();
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
