import { execFileSync } from "node:child_process";
import { getLocalSupabaseEnvironment } from "../tests/e2e/local-supabase";
execFileSync("npm", ["test", "--", "tests/integration"], {
  stdio: "inherit", env: { ...process.env, ...getLocalSupabaseEnvironment(), KUARTZ_DB_TESTS: "1" },
});
