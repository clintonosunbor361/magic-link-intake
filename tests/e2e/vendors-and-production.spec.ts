import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { E2E_USERS } from "@/tests/e2e/global-setup";

// The one Milestone 5 flow worth driving through a browser: the Vendor Brief export gate. It is the
// only behaviour where the interesting logic genuinely spans layers — a required measurement is
// missing, the server refuses the PDF, a Super Admin supplies a reason, and only then do bytes come
// back and an export get recorded. Everything else in this milestone (urgency bands, balance seams,
// bulk skip logic, status transitions, rating aggregation) is pure and unit-tested without a
// browser.

async function signIn(page: Page, user: (typeof E2E_USERS)[keyof typeof E2E_USERS]) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

// Desktop-chromium and mobile-chromium share one dev server, database and organization, so the two
// projects must not create people who trip the duplicate check — against each other or against any
// other spec's fixtures. That check (lib/enquiries/duplicate-match.ts) warns when names share half
// their tokens or land within an edit distance of 2, so a numeric suffix is not enough and neither
// is a distinct first name over a surname another spec already uses. Every token below is unique
// across the whole e2e suite.
const PROJECT_FIXTURES = {
  "mobile-chromium": { client: "Zubairu Danjuma", vendor: "Danjuma Workroom", phone: "08155509990" },
  default: { client: "Ifeoma Nwosu", vendor: "Ajayi Atelier", phone: "08155501110" },
} as const;

function fixturesFor(testInfo: TestInfo) {
  return testInfo.project.name === "mobile-chromium"
    ? PROJECT_FIXTURES["mobile-chromium"]
    : PROJECT_FIXTURES.default;
}

const ENQUIRY_DETAIL_URL = /\/enquiries\/[0-9a-f-]{36}$/i;

// The assignment drawers are native <details> disclosures. Each step below starts from a freshly
// loaded page so the disclosure is reliably closed, then opens it with a real click and waits for
// the revealed control — setting `open` directly races React's hydration, which resets it.
async function openDisclosure(disclosure: Locator, revealed: Locator) {
  await disclosure.locator("> summary").click();
  await expect(revealed).toBeVisible();
}

async function convertToOrderWithItem(
  page: Page,
  { fullName, phone, itemType }: { fullName: string; phone: string; itemType: string },
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

  // An item type with required measurements, so the brief starts blocked.
  const addItem = page.getByRole("form", { name: "Add Item — Ceremony Look" });
  await addItem.getByLabel("Type").selectOption(itemType);
  await addItem.getByRole("button", { name: "Add Item" }).click();

  return page.url();
}

test("a blocked Vendor Brief exports only after a Super Admin records an override reason", async ({
  page,
}, testInfo) => {
  const fixtures = fixturesFor(testInfo);
  const vendorName = fixtures.vendor;

  await signIn(page, E2E_USERS.superAdmin);

  const orderUrl = await convertToOrderWithItem(page, {
    fullName: fixtures.client,
    phone: fixtures.phone,
    itemType: "Cap",
  });

  // Quick-create a Vendor from the assignment drawer. Each <details> carries an explicit aria-label
  // because role="group" takes no name from its content.
  await page.goto(orderUrl);
  const assignDrawer = page.getByRole("group", { name: "Assign a Vendor to Cap" });
  const quickCreate = page.getByRole("group", { name: "Quick-create a Vendor for Cap" });
  const newVendorName = quickCreate.getByLabel("New Vendor name for Cap", { exact: true });

  await openDisclosure(assignDrawer, quickCreate.locator("> summary"));
  await openDisclosure(quickCreate, newVendorName);
  await newVendorName.fill(vendorName);
  await quickCreate.getByRole("button", { name: "Create Vendor" }).click();
  await expect(page).toHaveURL(orderUrl);

  // Fresh load so the drawer is reliably closed again before the assignment step.
  await page.goto(orderUrl);
  const drawer = page.getByRole("group", { name: "Assign a Vendor to Cap" });
  const vendorSelect = drawer.getByLabel("Vendor for Cap", { exact: true });
  await openDisclosure(drawer, vendorSelect);

  // Option labels carry the whole picker summary (specialties, scores, job counts), so match on the
  // option containing this Vendor's name and select by its value.
  const vendorOptionValue = await drawer
    .locator('select[name="vendorId"] option', { hasText: vendorName })
    .first()
    .getAttribute("value");
  await vendorSelect.selectOption(vendorOptionValue ?? "");
  await drawer.getByLabel("Deadline for Cap", { exact: true }).fill("2027-01-15");
  await drawer.getByRole("button", { name: "Assign Vendor" }).click();
  await expect(page).toHaveURL(orderUrl);
  // The drawer's label flips once the Item has a Vendor, which confirms the write landed rather
  // than the form quietly failing to submit.
  await expect(page.getByRole("group", { name: "Vendor assignment for Cap" })).toBeVisible();

  // The assignment succeeds even though measurements are missing — only export is gated.
  await page.goto("/production");
  // Match the Vendor link on the Item row, not the same name sitting in the filter dropdown's
  // <option> — an option inside a closed select never counts as visible.
  await expect(page.getByRole("link", { name: vendorName })).toBeVisible();
  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page).toHaveURL(/\/production\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/Missing required measurements: Head circumference/)).toBeVisible();

  await page.getByRole("link", { name: "Build brief" }).click();
  await expect(page).toHaveURL(/\/brief$/);

  // Blocked: the export button stays disabled until a reason is supplied.
  const exportButton = page.getByRole("button", { name: "Export PDF" });
  await expect(exportButton).toBeDisabled();

  await page.getByLabel("Override reason").fill("Vendor starts cutting today");
  await expect(exportButton).toBeEnabled();

  const download = page.waitForEvent("download");
  await exportButton.click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.pdf$/);

  // The export is recorded against the assignment, so the metadata is visible on reload.
  await page.goBack();
  await page.reload();
  await expect(page.getByText(/Last exported/)).toBeVisible();
});

test("an Admin Assistant cannot override a missing-measurement block", async ({ page }) => {
  await signIn(page, E2E_USERS.assistant);

  // The assistant belongs to the second organization, which has its own statuses seeded but no
  // Orders — enough to confirm the override affordance is absent for this role.
  await page.goto("/production");
  // Exact, because the empty state's own heading also contains the word "Production".
  await expect(page.getByRole("heading", { name: "Production", exact: true })).toBeVisible();
  await expect(page.getByText("Nothing in production yet")).toBeVisible();

  // Settings are Super Admin only, so the production status list is not reachable either.
  await page.goto("/settings/production-statuses");
  await expect(page).toHaveURL("/");
});
