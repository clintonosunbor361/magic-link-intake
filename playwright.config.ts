import { defineConfig, devices } from "@playwright/test";
import { getLocalSupabaseEnvironment } from "@/tests/e2e/local-supabase";

const localEnvironment = getLocalSupabaseEnvironment();
const baseURL = "http://127.0.0.1:3210";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm start -- --hostname 127.0.0.1 --port 3210",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      ...localEnvironment,
      NEXT_PUBLIC_APP_URL: baseURL,
    },
  },
});
