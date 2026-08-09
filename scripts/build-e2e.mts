import { execFileSync } from "node:child_process";
import { getLocalSupabaseEnvironment } from "../tests/e2e/local-supabase";

// Next.js inlines NEXT_PUBLIC_* values during the build. Build the E2E bundle with the local
// Supabase values explicitly so a developer's .env.local can never point browser tests at a real
// project while global setup seeds users into the local test database.
execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...getLocalSupabaseEnvironment(),
    KUARTZ_E2E: "1",
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3210",
  },
});
