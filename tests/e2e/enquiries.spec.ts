import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { E2E_USERS } from "@/tests/e2e/global-setup";

async function signIn(page: Page, user: (typeof E2E_USERS)[keyof typeof E2E_USERS]) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good morning/ })).toBeVisible();
}

async function selectGlassDropdown(page: Page, label: string, option: string) {
  await page.getByRole("button", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

// Desktop-chromium and mobile-chromium share one dev server and database, so
// identical test data created concurrently by both projects would collide.
function projectSuffix(testInfo: TestInfo): string {
  return testInfo.project.name === "mobile-chromium" ? "9" : "1";
}

function uniquePhone(testInfo: TestInfo, base: string): string {
  return `${base}${projectSuffix(testInfo)}`;
}

function uniqueName(testInfo: TestInfo, base: string): string {
  return `${base} ${projectSuffix(testInfo)}`;
}

// Matches only a real Enquiry detail URL (a UUID), never a redirect back to
// /enquiries/new?error=... (which also satisfies a looser /enquiries/[^/]+$ pattern).
const ENQUIRY_DETAIL_URL = /\/enquiries\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test("an external intake submission appears as an Enquiry in the inbox", async ({ page }, testInfo) => {
  const fullName = uniqueName(testInfo, "Adaeze Okonkwo");

  await signIn(page, E2E_USERS.superAdmin);
  await page.goto("/enquiries");

  await page.getByRole("button", { name: "Generate intake link" }).click();
  const urlText = await page.getByText(/\/i\/[\w-]+$/).textContent();
  const intakeUrl = urlText?.trim();
  expect(intakeUrl).toBeTruthy();

  await page.goto(intakeUrl!);
  await page.getByLabel("Full name").fill(fullName);
  await page.getByLabel("Primary phone").fill(uniquePhone(testInfo, "0803333444"));
  await page.getByLabel("Email").fill(`adaeze-${projectSuffix(testInfo)}@example.com`);
  await selectGlassDropdown(page, "Contact channel", "WhatsApp");
  await selectGlassDropdown(page, "Event type", "Wedding");
  await selectGlassDropdown(page, "Budget range", "Under 500k");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/intake\/success$/);

  await page.goto("/enquiries");
  await expect(page.getByRole("link", { name: fullName, exact: true })).toBeVisible();
});

test("a magic link can only be consumed once, even under concurrent submission", async ({ page }, testInfo) => {
  await signIn(page, E2E_USERS.superAdmin);

  const created = await page.request.post("/api/intake-links");
  expect(created.ok()).toBe(true);
  const { url } = (await created.json()) as { url: string };
  const submitUrl = `${url}/submit`;

  const submission = {
    fullName: uniqueName(testInfo, "Concurrent Test"),
    primaryPhone: uniquePhone(testInfo, "0809999888"),
    whatsappSameAsPrimary: "on",
    email: `concurrent-${projectSuffix(testInfo)}@example.com`,
    preferredContactChannel: "WhatsApp",
    eventType: "Wedding",
    budgetRange: "Under 500k",
    brief: "Concurrency test",
  };

  const [first, second] = await Promise.all([
    page.request.post(submitUrl, { form: submission }),
    page.request.post(submitUrl, { form: submission }),
  ]);

  const outcomes = [first.url().endsWith("/intake/success"), second.url().endsWith("/intake/success")];
  expect(outcomes.filter(Boolean)).toHaveLength(1);
});

test("creating an internal Enquiry warns on a duplicate phone and requires acknowledgment", async ({ page }, testInfo) => {
  const originalName = uniqueName(testInfo, "Bukola Adewale");
  const duplicateName = uniqueName(testInfo, "Bukola A.");
  const phone = uniquePhone(testInfo, "0805555666");

  await signIn(page, E2E_USERS.superAdmin);

  await page.goto("/enquiries/new");
  await page.getByLabel("Full name").fill(originalName);
  await page.getByLabel("Primary phone").fill(phone);
  await page.getByLabel("WhatsApp same as primary number").check();
  await page.getByLabel("Contact channel").selectOption("Phone call");
  await page.getByLabel("Event type").selectOption("Birthday");
  await page.getByLabel("Budget range").selectOption("500k to 1M");
  await page.getByRole("button", { name: "Create Enquiry" }).click();
  await expect(page).toHaveURL(ENQUIRY_DETAIL_URL);

  await page.goto("/enquiries/new");
  await page.getByLabel("Full name").fill(duplicateName);
  await page.getByLabel("Primary phone").fill(phone);
  await page.getByRole("button", { name: "Check for duplicates" }).click();
  await expect(page.getByText("Possible existing contacts found:")).toBeVisible();
  await expect(page.getByText(originalName)).toBeVisible();

  await page.getByLabel("WhatsApp same as primary number").check();
  await page.getByLabel("Contact channel").selectOption("Phone call");
  await page.getByLabel("Event type").selectOption("Birthday");
  await page.getByLabel("Budget range").selectOption("500k to 1M");

  await page.getByRole("button", { name: "Create Enquiry" }).click();
  await expect(page).toHaveURL(/\/enquiries\/new\?error=/);

  await page.getByLabel("Full name").fill(duplicateName);
  await page.getByLabel("Primary phone").fill(phone);
  await page.getByRole("button", { name: "Check for duplicates" }).click();
  await expect(page.getByText("Possible existing contacts found:")).toBeVisible();
  await page.getByLabel(/I've reviewed these/).check();
  await page.getByLabel("WhatsApp same as primary number").check();
  await page.getByLabel("Contact channel").selectOption("Phone call");
  await page.getByLabel("Event type").selectOption("Birthday");
  await page.getByLabel("Budget range").selectOption("500k to 1M");
  await page.getByRole("button", { name: "Create Enquiry" }).click();
  await expect(page).toHaveURL(ENQUIRY_DETAIL_URL);
});

test("converting an Enquiry creates a Client and Active Order with an audit entry", async ({ page }, testInfo) => {
  const fullName = uniqueName(testInfo, "Tayo Balogun");

  await signIn(page, E2E_USERS.superAdmin);

  await page.goto("/enquiries/new");
  await page.getByLabel("Full name").fill(fullName);
  await page.getByLabel("Primary phone").fill(uniquePhone(testInfo, "0807777888"));
  await page.getByLabel("WhatsApp same as primary number").check();
  await page.getByLabel("Contact channel").selectOption("Email");
  await page.getByLabel("Event type").selectOption("Wedding");
  await page.getByLabel("Budget range").selectOption("1M to 2M");
  await page.getByRole("button", { name: "Create Enquiry" }).click();
  await expect(page).toHaveURL(ENQUIRY_DETAIL_URL);

  await page.getByRole("link", { name: "Convert to Client + Order" }).click();
  await expect(page).toHaveURL(/\/convert$/);

  await page.getByLabel("Final agreed price (₦)").fill("500000");
  await page.getByLabel("Look name").fill("Traditional Wedding");
  await page.getByRole("button", { name: "Convert Enquiry" }).click();

  await expect(page).toHaveURL(ENQUIRY_DETAIL_URL);
  await expect(page.getByText(/Converted into Client/)).toBeVisible();

  await page.goto("/settings/team");
  await expect(
    page.getByText(new RegExp(`Converted ${fullName} into a Client and Active Order`)).first(),
  ).toBeVisible();
});
