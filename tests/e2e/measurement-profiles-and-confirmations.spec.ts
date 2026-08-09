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

async function createClient(page: Page, testInfo: TestInfo, fullName: string, phone: string) {
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
  await page.getByLabel("Look name").fill("First Look");
  await page.getByRole("button", { name: "Convert Enquiry" }).click();
  await expect(page).toHaveURL(ENQUIRY_DETAIL_URL);

  // The Client's name is only a clickable link from the Order page, not the Enquiry page.
  await page.goto("/orders");
  await page.getByPlaceholder("Search by Order title or Client name").fill(orderTitle);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: orderTitle }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);

  await page.getByRole("link", { name: fullName }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  return page.url();
}

test("staff records a Client's measurements with history and the client confirms them via the link", async ({ page }, testInfo) => {
  const fullName = uniqueName(testInfo, "Kemi Adeyemi");
  const phone = uniquePhone(testInfo, "0821112222");

  await signIn(page, E2E_USERS.superAdmin);
  const clientUrl = await createClient(page, testInfo, fullName, phone);

  const neckForm = page.getByRole("form", { name: "Measurement — Neck" });
  await neckForm.getByLabel("Neck (in)").fill("15.5");
  await neckForm.getByLabel("Note").fill("First fitting");
  await neckForm.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(clientUrl);
  await expect(page.getByLabel("Neck (in)")).toHaveValue("15.5");
  await expect(page.getByText(/Set by/)).toBeVisible();

  const neckFormAfterSave = page.getByRole("form", { name: "Measurement — Neck" });
  await neckFormAfterSave.getByLabel("Neck (in)").fill("16");
  await neckFormAfterSave.getByLabel("Note").fill("Adjusted after second fitting");
  await neckFormAfterSave.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(clientUrl);
  await expect(page.getByLabel("Neck (in)")).toHaveValue("16");

  // Two revisions: the first save (unset → 15.5) and the second (15.5 → 16).
  await page.getByText("Edit history (2)").click();
  await expect(page.getByText("15.5 → 16")).toBeVisible();

  const imageBuffer = await sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 30, g: 120, b: 200 } },
  })
    .jpeg()
    .toBuffer();
  await page.getByLabel("Upload sheet/photo").setInputFiles({ name: "measurements.jpg", mimeType: "image/jpeg", buffer: imageBuffer });
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page).toHaveURL(clientUrl);
  await expect(page.getByRole("link", { name: "View attachment" })).toBeVisible();

  await page.getByRole("button", { name: "Send measurement confirmation" }).click();
  await expect(page).toHaveURL(/\/measurement-confirmations\/[0-9a-f-]{36}\/created\?token=/);

  const confirmationLink = (await page.locator("code").textContent())?.trim();
  expect(confirmationLink).toBeTruthy();

  await page.getByRole("button", { name: "Mark as copied for WhatsApp" }).click();
  await expect(page).toHaveURL(/copied=1/);

  await page.context().clearCookies();
  await page.goto(confirmationLink!);
  await expect(page.getByRole("heading", { name: "Confirm your measurements" })).toBeVisible();
  await expect(page.getByText(fullName)).toBeVisible();
  await expect(page.getByText("16 in")).toBeVisible();
  await page.getByLabel("Decision").selectOption("confirmed");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Decision: Confirmed")).toBeVisible();

  await signIn(page, E2E_USERS.superAdmin);
  await page.goto(clientUrl);
  await expect(page.getByText("Completed")).toBeVisible();
});
