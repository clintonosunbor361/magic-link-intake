import { expect, test, type Page, type TestInfo } from "@playwright/test";
import sharp from "sharp";
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
  return testInfo.project.name === "mobile-chromium"
    ? "9"
    : testInfo.project.name === "small-mobile-chromium"
      ? "5"
      : "1";
}

function uniquePhone(testInfo: TestInfo, base: string): string {
  return `${base}${projectSuffix(testInfo)}`;
}

function uniqueName(testInfo: TestInfo, base: string): string {
  const compact = base.replace(/\s+/g, "");
  const marker = testInfo.project.name === "mobile-chromium" ? "MobileKilo" : testInfo.project.name === "small-mobile-chromium" ? "PocketZulu" : "DesktopAlpha";
  return `${compact}${compact}${marker}`;
}

const ENQUIRY_DETAIL_URL = /\/enquiries\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test("staff builds a Style Direction approval batch and the client decides via the link", async ({ page }, testInfo) => {
  // "Bello"/"Ijeoma" don't overlap with any other spec's fixture names in this suite.
  const fullName = uniqueName(testInfo, "Ijeoma Bello");
  const phone = uniquePhone(testInfo, "0818889999");

  await signIn(page, E2E_USERS.superAdmin);

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
  await page.getByLabel("Look name").fill("Ceremony Look");
  await page.getByRole("button", { name: "Convert Enquiry" }).click();
  await expect(page).toHaveURL(ENQUIRY_DETAIL_URL);

  await page.goto("/orders");
  await page.getByPlaceholder("Search by Order title or Client name").fill(orderTitle);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: orderTitle }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderUrl = page.url();

  const addNoteForm = page.getByRole("form", { name: "Add a Consultation Note" });
  await addNoteForm.locator('textarea[name="body"]').fill("Client wants a slimmer silhouette.");
  await addNoteForm.getByRole("button", { name: "Add Consultation Note" }).click();
  await expect(page).toHaveURL(orderUrl);
  await expect(page.getByText("Client wants a slimmer silhouette.")).toBeVisible();

  const imageBuffer = await sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .jpeg()
    .toBuffer();

  const addFileForm = page.getByRole("form", { name: "Add a Style Direction File" });
  await addFileForm.getByLabel("Category").selectOption("moodboard");
  await addFileForm.getByLabel("Requires client approval").check();
  await addFileForm.getByLabel("File").setInputFiles({ name: "moodboard.jpg", mimeType: "image/jpeg", buffer: imageBuffer });
  await addFileForm.getByRole("button", { name: "Add Style Direction File" }).click();
  await expect(page).toHaveURL(orderUrl);
  await expect(page.getByText("Requires client approval · Pending")).toBeVisible();

  await page.getByRole("link", { name: "Create approval batch" }).click();
  await expect(page).toHaveURL(/\/approval-batches\/new$/);
  await page.getByLabel("Moodboard").check();
  await page.getByRole("button", { name: "Create approval batch" }).click();
  await expect(page).toHaveURL(/\/approval-batches\/[0-9a-f-]{36}\/created\?token=/);

  const approvalUrl = (await page.locator("code").textContent())?.trim();
  expect(approvalUrl).toBeTruthy();

  await page.getByRole("button", { name: "Mark as copied for WhatsApp" }).click();
  await expect(page).toHaveURL(/copied=1/);

  await page.context().clearCookies();
  await page.goto(approvalUrl!);
  await expect(page.getByRole("heading", { name: "Style direction for your review" })).toBeVisible();
  await page.getByLabel("Decision").selectOption("approved");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Decision: Approved")).toBeVisible();

  await signIn(page, E2E_USERS.superAdmin);
  await page.goto(orderUrl);
  await expect(page.getByText("Nothing is pending client approval.")).toBeVisible();
  await expect(page.getByText("Requires client approval · Approved")).toBeVisible();
});
