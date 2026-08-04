import { execFileSync } from "node:child_process";

export function getLocalSupabaseEnvironment(): Record<string, string> {
  let output: string;
  try {
    output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "Local Supabase is not running. Install Docker, then run `npm run supabase:start`.",
    );
  }

  const values = Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)="?(.*?)"?$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2].replace(/"$/, "")]),
  );

  const required = (key: string) => {
    const value = values[key];
    if (!value) throw new Error(`Supabase status did not return ${key}.`);
    return value;
  };

  return {
    NEXT_PUBLIC_SUPABASE_URL: required("API_URL"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      values.PUBLISHABLE_KEY ?? required("ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: values.SECRET_KEY ?? required("SERVICE_ROLE_KEY"),
    DATABASE_URL: required("DB_URL"),
  };
}
