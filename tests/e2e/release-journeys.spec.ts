import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import postgres from "postgres";
import { getLocalSupabaseEnvironment } from "./local-supabase";
import { E2E_USERS } from "./global-setup";

async function chooseField(page: Page, name: string, label: string) {
  const control = page.locator(`[name="${name}"]`);
  if (await control.evaluate((element) => element.tagName === "SELECT")) {
    await control.selectOption({ label });
  } else {
    const dropdown = control.locator("..");
    await dropdown.getByRole("button").first().click();
    await dropdown.getByRole("option", { name: label, exact: true }).click();
  }
}

async function signIn(page: Page, user = E2E_USERS.superAdmin) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email address", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function createClient(page: Page, name: string) {
  await page.goto("/clients/new");
  await page.locator('[name="fullName"]').fill(name);
  await page.locator('[name="primaryPhone"]').fill(`080${Date.now().toString().slice(-8)}`);
  await page.locator('[name="email"]').fill(`${Date.now()}@example.test`);
  await page.locator('[name="brief"]').fill("Release verification contact.");
  await chooseField(page, "preferredContactChannel", "WhatsApp");
  await chooseField(page, "eventType", "Wedding");
  await chooseField(page, "budgetRange", "500k to 1M");
  await page.getByRole("button", { name: "Create Client", exact: true }).click();
  await expect.poll(async () => /\/clients\/[0-9a-f-]{36}$/.test(page.url()) || await page.getByRole("button", { name: "Create anyway", exact: true }).isVisible()).toBe(true);
  if (await page.getByRole("button", { name: "Create anyway", exact: true }).isVisible()) await page.getByRole("button", { name: "Create anyway", exact: true }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  return page.url().split("/").at(-1)!;
}

async function createOrder(page: Page, clientId: string) {
  await page.goto(`/clients/${clientId}/orders/new`);
  await page.getByLabel("Order title", { exact: true }).fill("Release Wedding");
  await chooseField(page, "eventType", "Wedding");
  await page.locator('[name="finalAgreedPrice"]').fill("100000");
  await page.getByLabel("Look 1 name").fill("Ceremony");
  await page.getByRole("button", { name: "Add look", exact: true }).click();
  await page.getByLabel("Look 2 name").fill("Reception");
  await page.getByRole("button", { name: "Create Order", exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  return page.url().split("/").at(-1)!;
}

test("unauthenticated routes redirect and invalid capabilities stay isolated", async ({ page }) => {
  await page.goto("/clients");
  await expect(page).toHaveURL(/auth\/sign-in/);
  for (const path of ["/intake/not-a-token", "/confirm/not-a-token", "/approve/not-a-token"]) {
    await page.goto(path);
    await expect(page.getByText(/no longer active|inactive|expired/i).first()).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  }
});

test("Client to Order, workspace, confirmation, invoice PDF and payment-gated completion", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await signIn(page);
  const clientId = await createClient(page, `Release Client ${Date.now()}`);
  const orderId = await createOrder(page, clientId);
  await expect(page.getByRole("navigation", { name: "Order workspace tabs" }).getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
  for (const tab of ["looks", "style", "measurements", "vendors", "production", "accessories", "fittings", "payments"]) {
    await page.goto(`/orders/${orderId}?tab=${tab}`);
    await expect(page.locator("main")).not.toContainText("Something went wrong");
  }
  await page.goto(`/orders/${orderId}?tab=invalid`);
  await expect(page.getByRole("button", { name: "Send order confirmation" })).toBeVisible();
  await page.getByRole("button", { name: "Send order confirmation" }).click();
  await expect(page).toHaveURL(/confirmations\/.*\/created/);
  const token = new URL(page.url()).searchParams.get("token")!;
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto(`http://127.0.0.1:3210/confirm/${token}`);
  await expect(clientPage.getByText("Release Wedding", { exact: true })).toBeVisible();
  await expect(clientPage.locator('input[type="file"]')).toHaveCount(0);
  await clientPage.locator('[name="decision"]').selectOption("correction_requested");
  await clientPage.locator('button[type="submit"]').click();
  await expect(clientPage.getByText(/^A comment is required/i)).toBeVisible();
  await clientPage.locator('[name="comment"]').fill("Please review the Look name.");
  await clientPage.locator('button[type="submit"]').click();
  await expect(clientPage.getByText(/recorded|thank|correction requested/i).first()).toBeVisible();
  await clientContext.close();

  await page.goto(`/orders/${orderId}/invoice`);
  await page.locator('[name="lineDescription"]').first().fill("Agreed styling");
  await page.locator('[name="lineQuantity"]').first().fill("1");
  await page.locator('[name="lineUnitPrice"]').first().fill("100000");
  await page.getByRole("button", { name: "Create Invoice", exact: true }).click();
  await expect(page.getByText("Total invoiced", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Mark sent & download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await page.goto(`/orders/${orderId}`);
  await page.locator('form').filter({ has: page.locator('[name="overrideReason"]') }).evaluate((form) => { (form as HTMLFormElement).noValidate = true; });
  await page.getByRole("button", { name: "Mark delivered and complete", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(/reason|balance/i);
  await page.goto(`/orders/${orderId}/invoice`);
  await page.getByRole("button", { name: "Record payment", exact: true }).click();
  await page.locator('[name="amount"]').last().fill("100000");
  await page.locator('form').filter({ has: page.locator('[name="amount"]') }).last().getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  await page.goto(`/orders/${orderId}`);
  await page.getByRole("button", { name: "Mark delivered and complete", exact: true }).click();
  await expect(page.getByText(/^Completed \d/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark delivered and complete", exact: true })).toHaveCount(0);
  await page.goto(`/clients/${clientId}/orders/new`);
  await expect(page.getByText("This Client already has active Orders.", { exact: false })).toHaveCount(0);
});

test("staff screens remain usable at mobile widths", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/clients", "/orders", "/production", "/finance"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast"]).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("external intake is one use and captures the client brief", async ({ page, browser }) => {
  await signIn(page);
  const response = await page.request.post("/api/intake-links");
  expect(response.ok()).toBe(true);
  const { url } = await response.json();
  const context = await browser.newContext();
  const clientPage = await context.newPage();
  await clientPage.goto(url);
  await clientPage.locator('[name="fullName"]').fill(`Intake Release ${Date.now()}`);
  await clientPage.locator('[name="primaryPhone"]').fill(`081${Date.now().toString().slice(-8)}`);
  await clientPage.locator('[name="email"]').fill(`${Date.now()}@example.test`);
  for (const [label, option] of [["Contact channel", "WhatsApp"], ["Event type", "Wedding"], ["Budget range", "500k to 1M"]]) {
    await clientPage.getByRole("button", { name: new RegExp(label) }).click();
    await clientPage.getByRole("option", { name: option, exact: true }).click();
  }
  await clientPage.locator('[name="brief"]').fill("A ceremony and reception outfit.");
  await clientPage.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(clientPage).toHaveURL(/intake\/success/);
  await clientPage.goto(url);
  await expect(clientPage.getByText(/no longer active|inactive|expired/i).first()).toBeVisible();
  await context.close();
  await page.goto("/clients");
  await expect(page.getByText(/Intake Release/).filter({ visible: true }).first()).toBeVisible();
});

test("assistant may enter finance but cannot open reserved settings", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email address", { exact: true }).fill(E2E_USERS.assistant.email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_USERS.assistant.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  for (const path of ["/settings/team", "/settings/lead-sources", "/settings/production-statuses"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
  }
  await page.goto("/finance");
  await expect(page).toHaveURL(/\/finance$/);
  await expect(page.getByText("Release Wedding", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/auth\/sign-in/);
});


test("Style Direction approval and Vendor Brief export preserve scope and blockers", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await signIn(page);
  const clientId = await createClient(page, `Creative Client ${Date.now()}`);
  const orderId = await createOrder(page, clientId);
  await page.goto(`/orders/${orderId}?tab=style`);
  await page.getByRole("button", { name: "Add Style Direction File", exact: true }).click();
  const upload = page.getByRole("form", { name: "Add a Style Direction File" });
  await upload.locator('[name="requiresClientApproval"]').check();
  await upload.locator('[name="file"]').setInputFiles({ name: "moodboard.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
  await upload.getByRole("button", { name: "Add Style Direction File", exact: true }).click();
  await expect(page.getByRole("group", { name: "Moodboard for Whole Order" })).toBeVisible();
  await page.getByRole("link", { name: "Create approval batch", exact: true }).click();
  await page.locator('[name="fileIds"]').check();
  await page.getByRole("button", { name: "Create approval batch", exact: true }).click();
  await expect(page).toHaveURL(/approval-batches\/.*\/created/);
  const token = new URL(page.url()).searchParams.get("token")!;
  const context = await browser.newContext();
  const external = await context.newPage();
  await external.goto(`http://127.0.0.1:3210/approve/${token}`);
  await expect(external.locator('input[type="file"]')).toHaveCount(0);
  await external.locator('[name="decision"]').selectOption("with_revisions");
  await external.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(external.getByText(/^A comment is required/i)).toBeVisible();
  await external.locator('[name="decision"]').selectOption("approved");
  await external.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(external.getByText("Decision: Approved", { exact: true })).toBeVisible();
  await expect(external.getByRole("button", { name: "Submit", exact: true })).toHaveCount(0);
  await context.close();
  await page.goto(`/orders/${orderId}?tab=style`);
  await expect(page.getByRole("group", { name: "Moodboard for Whole Order" })).toContainText("Revision 1: Approved");

  // Seed a production assignment to isolate the export journey from vendor-picker interaction.
  const sql = postgres(getLocalSupabaseEnvironment().DATABASE_URL, { prepare: false, max: 1 });
  try {
    const [assignment] = await sql.begin(async (tx) => {
      const [order] = await tx`select organization_id, primary_owner_staff_id from orders where id = ${orderId}`;
      const [look] = await tx`select id from looks where order_id = ${orderId} order by created_at limit 1`;
      const [type] = await tx`select id from item_types where organization_id = ${order.organization_id} and name = 'Suit'`;
      const [status] = await tx`select id from production_statuses where organization_id = ${order.organization_id} and name = 'Not Started'`;
      const [vendor] = await tx`insert into vendors (organization_id, name) values (${order.organization_id}, 'Release Tailor') returning id`;
      const [item] = await tx`insert into items (organization_id, look_id, item_type_id, quantity) values (${order.organization_id}, ${look.id}, ${type.id}, 1) returning id`;
      return tx`insert into vendor_assignments (organization_id, item_id, vendor_id, production_status_id, deadline, assigned_by_staff_id) values (${order.organization_id}, ${item.id}, ${vendor.id}, ${status.id}, '2026-12-10', ${order.primary_owner_staff_id}) returning id`;
    });
    await page.goto(`/production/${assignment.id}/brief`);
    await expect(page.getByRole("button", { name: /Export.*PDF/i })).toBeDisabled();
    await page.getByLabel(/Override reason/i).fill("Measurements verified on the paper sheet for this test.");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export.*PDF/i }).click();
    expect((await downloadPromise).suggestedFilename()).toMatch(/vendor-brief.*\.pdf$/);
    const [row] = await sql`select brief_last_exported_at from vendor_assignments where id = ${assignment.id}`;
    expect(row.brief_last_exported_at).not.toBeNull();
  } finally { await sql.end(); }
});
