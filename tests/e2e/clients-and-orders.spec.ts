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

// Converts a fresh Enquiry into a Client + Active Order with one Look, then
// navigates to that Order's edit surface via the Orders directory search.
async function convertToOrder(
  page: Page,
  testInfo: TestInfo,
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

test("editing a Client's identity is reflected in the Clients directory search", async ({ page }, testInfo) => {
  const fullName = uniqueName(testInfo, "Ngozi Umeh");
  const phone = uniquePhone(testInfo, "0812221111");
  const newPhone = uniquePhone(testInfo, "0899998888");

  await signIn(page, E2E_USERS.superAdmin);
  await convertToOrder(page, testInfo, { fullName, phone, firstLookName: "First Look" });

  await page.getByRole("link", { name: fullName }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);

  await page.getByLabel("Primary phone").fill(newPhone);
  await page.getByLabel("Email").fill(`ngozi-${projectSuffix(testInfo)}@example.com`);
  await page.getByRole("button", { name: "Save identity" }).click();
  await expect(page.getByLabel("Primary phone")).toHaveValue(newPhone);

  await page.goto("/clients");
  // The stored phone is normalized to its last 10 digits, so search on that
  // form rather than the full raw string (which would never be a substring).
  await page.getByPlaceholder("Search by name, phone, or email").fill(newPhone.slice(-10));
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("link", { name: fullName })).toBeVisible();
});

test("an Order's last remaining Look cannot be archived, but a non-last one can", async ({ page }, testInfo) => {
  const fullName = uniqueName(testInfo, "Chidi Eze");
  const phone = uniquePhone(testInfo, "0813332222");

  await signIn(page, E2E_USERS.superAdmin);
  const { orderUrl } = await convertToOrder(page, testInfo, { fullName, phone, firstLookName: "First Look" });

  await page.getByRole("form", { name: "Add a Look" }).getByLabel("Name").fill("Second Look");
  await page.getByRole("form", { name: "Add a Look" }).getByRole("button", { name: "Add Look" }).click();
  await expect(page).toHaveURL(orderUrl);

  const firstLook = page.getByRole("group", { name: "First Look" });
  const secondLook = page.getByRole("group", { name: "Second Look" });
  await expect(firstLook).toBeVisible();
  await expect(secondLook).toBeVisible();

  await firstLook.getByRole("button", { name: "Archive Look" }).click();
  await expect(page).toHaveURL(orderUrl);
  await expect(page.getByRole("group", { name: "First Look" })).toContainText("Archived");

  await secondLook.getByRole("button", { name: "Archive Look" }).click();
  await expect(page).toHaveURL(/\?error=/);
  // Scoped to the error banner's class, not just role="alert" — Next.js's
  // route announcer also has role="alert" and would make this locator
  // resolve to two elements under strict mode.
  await expect(page.locator("p.form-alert")).toContainText("An Order must have at least one Look.");
  await expect(page.getByRole("group", { name: "Second Look" })).not.toContainText("Archived");
});

test("adding an Item to a Look constrains its type to the configured list", async ({ page }, testInfo) => {
  const fullName = uniqueName(testInfo, "Femi Coker");
  const phone = uniquePhone(testInfo, "0814443333");

  await signIn(page, E2E_USERS.superAdmin);
  const { orderUrl } = await convertToOrder(page, testInfo, { fullName, phone, firstLookName: "Outfit Look" });

  const addItemForm = page.getByRole("form", { name: "Add Item — Outfit Look" });
  await expect(addItemForm.getByLabel("Type")).toBeVisible();
  await addItemForm.getByLabel("Type").selectOption("Suit");
  await addItemForm.getByLabel("Qty").fill("2");
  await addItemForm.getByRole("button", { name: "Add Item" }).click();
  await expect(page).toHaveURL(orderUrl);

  const outfitLook = page.getByRole("group", { name: "Outfit Look" });
  await expect(outfitLook.getByText("No Items yet on this Look.")).toHaveCount(0);
  const typeSelect = outfitLook.locator("select[name='itemTypeId']").first();
  await expect(typeSelect).toBeVisible();
  const selectedTypeName = await typeSelect.evaluate((element: HTMLSelectElement) => element.options[element.selectedIndex]?.text);
  expect(selectedTypeName).toBe("Suit");
});

test("applying an FF discount never changes the Order's Final Agreed Price", async ({ page }, testInfo) => {
  const fullName = uniqueName(testInfo, "Zainab Suleiman");
  const phone = uniquePhone(testInfo, "0816665555");

  await signIn(page, E2E_USERS.superAdmin);
  const { orderUrl } = await convertToOrder(page, testInfo, { fullName, phone, firstLookName: "FF Look" });

  await page.getByLabel("Final agreed price (₦)").fill("500000");
  await page.getByRole("checkbox", { name: "Family & friends discount applied" }).check();
  await page.getByLabel(/FF discount amount/).fill("50000");
  await page.getByRole("button", { name: "Save Order details" }).click();
  await expect(page).toHaveURL(orderUrl);

  await expect(page.getByLabel("Final agreed price (₦)")).toHaveValue("500000.00");
  await expect(page.getByRole("checkbox", { name: "Family & friends discount applied" })).toBeChecked();
  await expect(page.getByLabel(/FF discount amount/)).toHaveValue("50000.00");
});

test("only a Super Admin can manage the Item Types list", async ({ page }, testInfo) => {
  const typeName = uniqueName(testInfo, "Turban");

  await signIn(page, E2E_USERS.superAdmin);
  await page.goto("/settings/item-types");
  await page.getByLabel("Name").fill(typeName);
  await page.getByRole("button", { name: "Add item type" }).click();
  await expect(page).toHaveURL("/settings/item-types");
  const row = page.getByRole("listitem", { name: typeName });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: `Archive ${typeName}` }).click();
  await expect(row).toContainText("Archived");

  const fullName = uniqueName(testInfo, "Bisi Fashola");
  const phone = uniquePhone(testInfo, "0815554444");
  await convertToOrder(page, testInfo, { fullName, phone, firstLookName: "Only Look" });
  const addItemForm = page.getByRole("form", { name: "Add Item — Only Look" });
  await expect(addItemForm.getByLabel("Type").locator(`option:text-is("${typeName}")`)).toHaveCount(0);

  await signIn(page, E2E_USERS.assistant);
  await page.goto("/settings/item-types");
  await expect(page).toHaveURL("/");
});
