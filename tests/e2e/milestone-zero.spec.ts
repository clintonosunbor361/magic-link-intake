import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_USERS } from "@/tests/e2e/global-setup";

async function signIn(page: Page, user: (typeof E2E_USERS)[keyof typeof E2E_USERS]) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
}

test("signed-out staff routes redirect to sign in", async ({ page }) => {
  await page.goto("/settings/team");
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test("a Super Admin can reach the dashboard, team settings, and legacy intake", async ({ page, isMobile }) => {
  await signIn(page, E2E_USERS.superAdmin);
  await expect(page.getByRole("heading", { name: /Good morning, Roti/ })).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Team and access" })).toBeVisible();
  await expect(page.getByText("Separate Atelier")).toHaveCount(0);
  await page.goto("/intake-links");
  await expect(page.getByRole("heading", { name: "Intake links" })).toBeVisible();
  await expect(page.getByText("Legacy", { exact: true })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test("an Admin Assistant cannot reach Super Admin settings", async ({ page }) => {
  await signIn(page, E2E_USERS.assistant);
  await expect(page.getByRole("heading", { name: /Good morning, Teni/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await page.goto("/settings/team");
  await expect(page).toHaveURL(/\/$/);
});

test("an authenticated non-member receives a stable unauthorized state", async ({ page }) => {
  await signIn(page, E2E_USERS.unauthorized);
  await expect(page).toHaveURL(/\/auth\/unauthorized$/);
  await expect(page.getByRole("heading", { name: "This account has no active workspace" })).toBeVisible();
});

test("mobile navigation closes with Escape and restores focus", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile navigation behavior");
  await signIn(page, E2E_USERS.superAdmin);
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.click();
  await expect(page.getByRole("complementary", { name: "Primary navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("reduced-motion preference suppresses transitions", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/auth/sign-in");
  const duration = await page.getByRole("button", { name: "Sign in" }).evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  expect(duration).toBe("0.001s");
  await context.close();
});
