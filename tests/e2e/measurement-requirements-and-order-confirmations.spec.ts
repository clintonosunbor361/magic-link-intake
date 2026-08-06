import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { E2E_USERS } from "@/tests/e2e/global-setup";

async function signIn(page: Page, user: (typeof E2E_USERS)[keyof typeof E2E_USERS]) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
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

const ENQUIRY_DETAIL_URL = /\/enquiries\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function convertToOrder(
  page: Page,
  { fullName, phone, firstLookName }: { fullName: string; phone: string; firstLookName: string },
) {
  await page.goto("/enquiries/new");
  await page.getByLabel("Full name").fill(fullName);
  await page.getByLabel("Primary phone").fill(phone);
  await page.getByLabel("WhatsApp same as primary number").check();
  await page.getByLabel("Contact channel").selectOption("Phone call");
  await page.getByLabel("Event type").selectOption("Wedding");
  await page.getByLabel("Budget range").selectOption("500k to 1M");
  await page.getByRole("button", { name: "Create Enquiry" }).click();
  await expect(page).toHaveURL(ENQUIRY_DETAIL_URL);

  await page.getByRole("link", { name: "Convert to Client + Order" }).click();
  await expect(page).toHaveURL(/\/convert$/);
  const orderTitle = `${fullName} — Wedding`;
  await page.getByLabel("Final agreed price (₦)").fill("500000");
  await page.getByLabel("Look name").fill(firstLookName);
  await page.getByRole("button", { name: "Convert Enquiry" }).click();
  await expect(page).toHaveURL(ENQUIRY_DETAIL_URL);

  await page.goto("/orders");
  await page.getByPlaceholder("Search by Order title or Client name").fill(orderTitle);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: orderTitle }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);

  return { orderUrl: page.url(), orderTitle };
}

test("an Item flags missing measurements and a client can request a correction on the order confirmation", async ({ page }, testInfo) => {
  const fullName = uniqueName(testInfo, "Dapo Balogun");
  const phone = uniquePhone(testInfo, "0822223333");

  await signIn(page, E2E_USERS.superAdmin);
  const { orderUrl } = await convertToOrder(page, { fullName, phone, firstLookName: "Cap Look" });

  // "Cap" is seeded to require only Head circumference, and this Client's measurement
  // profile has nothing recorded yet, so the badge should name exactly that one field.
  const addItemForm = page.getByRole("form", { name: "Add Item — Cap Look" });
  await addItemForm.getByLabel("Type").selectOption("Cap");
  await addItemForm.getByRole("button", { name: "Add Item" }).click();
  await expect(page).toHaveURL(orderUrl);
  await expect(page.getByText("Missing measurements: Head circumference")).toBeVisible();

  await page.getByRole("button", { name: "Send order confirmation" }).click();
  await expect(page).toHaveURL(/\/confirmations\/[0-9a-f-]{36}\/created\?token=/);

  const confirmationLink = (await page.locator("code").textContent())?.trim();
  expect(confirmationLink).toBeTruthy();

  await page.getByRole("button", { name: "Mark as copied for WhatsApp" }).click();
  await expect(page).toHaveURL(/copied=1/);

  await page.context().clearCookies();
  await page.goto(confirmationLink!);
  await expect(page.getByRole("heading", { name: "Confirm your order details" })).toBeVisible();
  await expect(page.getByText("Cap Look")).toBeVisible();
  await expect(page.getByText("₦500000.00")).toBeVisible();
  await page.getByLabel("Decision").selectOption("correction_requested");
  await page.getByLabel("Comment").fill("The price we agreed was different.");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Decision: Correction requested")).toBeVisible();
  await expect(page.getByText("The price we agreed was different.")).toBeVisible();

  await signIn(page, E2E_USERS.superAdmin);
  await page.goto(orderUrl);
  await expect(page.getByText("Completed")).toBeVisible();
  await expect(page.getByText('"The price we agreed was different."')).toBeVisible();
});
