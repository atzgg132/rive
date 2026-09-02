import { expect, test, type Page } from "@playwright/test";

async function mockInvoiceWorkspace(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (pathname === "/api/auth/session") return json({ success: true, user: { id: "ux-user", name: "UX Tester", email: "ux@rive.test", plan: "free", onboarding_status: "complete", display_currency: "USD" }, featureAvailability: { agreements: false } });
    if (pathname === "/api/rates") return json({ success: true, data: { base: "USD", date: "2026-08-15", rates: { USD: 1, EUR: 0.9, INR: 83 } } });
    if (pathname === "/api/workflow/clients") return json({ success: true, clients: [{ id: "client-1", name: "Northstar Studio", email: "client@example.com" }] });
    if (pathname === "/api/workflow/projects") return json({ success: true, projects: [{ id: "project-1", title: "Launch site", client_id: "client-1", currency: "USD" }] });
    if (pathname === "/api/workflow/invoices") {
      if (request.method() === "POST") {
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, invoice: { invoiceNumber: "INV-2026-0001" } }) });
      }
      return json({ success: true, invoices: [] });
    }
    return json({ success: true, available: false, notifications: [], activation: null });
  });
}

test.describe("invoice workspace UX", () => {
  test("desktop editor exposes the review-first layout and discount math", async ({ page }) => {
    await mockInvoiceWorkspace(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/workflow/invoices/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Create a polished invoice" })).toBeVisible();
    await page.getByRole("combobox", { name: "Client" }).selectOption("client-1");
    await page.getByLabel("Line item 1 description").fill("Product strategy sprint");
    await page.getByLabel("Line item 1 rate").fill("100");
    await page.getByLabel("Discount (%)").fill("10");
    await page.getByLabel("Tax rate (%)").fill("18");
    await expect(page.getByText("$106.20")).toBeVisible();
    const geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  });

  test("mobile editor remains usable without horizontal overflow", async ({ page }) => {
    await mockInvoiceWorkspace(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/workflow/invoices/new", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Create a polished invoice" })).toBeVisible();
    const geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
  });

  test("manual creation leaves invoice numbering to the server", async ({ page }) => {
    await mockInvoiceWorkspace(page);
    await page.goto("/workflow/invoices/new", { waitUntil: "domcontentloaded" });
    await page.getByRole("combobox", { name: "Client" }).selectOption("client-1");
    await page.getByLabel("Line item 1 description").fill("Manual invoice coverage");
    await page.getByLabel("Line item 1 rate").fill("125");

    const saveRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/workflow/invoices" && request.method() === "POST");
    await page.getByRole("button", { name: "Save draft" }).click();
    const body = saveRequest.then((request) => request.postDataJSON() as Record<string, unknown>);
    await expect(page).toHaveURL(/\/workflow\/revenue$/);
    expect(await body).not.toHaveProperty("invoice_number");
  });
});
