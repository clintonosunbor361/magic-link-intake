import { execFileSync } from "node:child_process";
import { getLocalSupabaseEnvironment } from "../tests/e2e/local-supabase";

const environment = getLocalSupabaseEnvironment();
execFileSync("npm", ["run", "db:migrate"], {
  stdio: "inherit", env: { ...process.env, ...environment },
});
// pgTAP fixtures are transactional and roll back. Never reset a developer's database.
execFileSync("npx", ["supabase", "test", "db"], { stdio: "inherit" });
