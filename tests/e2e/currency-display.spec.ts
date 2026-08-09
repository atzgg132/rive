import { expect, test, type Page, type Route } from "@playwright/test";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockCurrencyWorkspace(page: Page) {
  let displayCurrency = "INR";
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/auth/session") {
      return json(route, {
        success: true,
        user: { id: "user-1", name: "Currency Tester", email: "currency@rive.test", plan: "pro", onboarding_status: "complete", display_currency: displayCurrency },
      });
    }
    if (pathname === "/api/preferences/currency" && request.method() === "PATCH") {
      displayCurrency = request.postDataJSON().displayCurrency;
      return json(route, { success: true, displayCurrency });
    }
    if (pathname === "/api/rates") {
      return json(route, { success: true, data: { base: "USD", date: "2026-08-07", rates: { INR: 83, EUR: 0.9, GBP: 0.8 } } });
    }
    if (pathname === "/api/workflow/invoices") {
      return json(route, {
        success: true,
        invoices: [
          { id: "usd", invoice_number: "INV-USD", status: "paid", currency: "USD", total: "100", subtotal: "100", tax_rate: "0", tax_amount: "0", issue_date: "2026-08-01", due_date: null, paid_date: "2026-08-02", notes: null, client_id: null, project_id: null, client_name: "US client", project_title: null, contract_id: null, contract_title: null, created_at: "2026-08-01", items: [] },
          { id: "inr", invoice_number: "INV-INR", status: "paid", currency: "INR", total: "8300", subtotal: "8300", tax_rate: "0", tax_amount: "0", issue_date: "2026-08-01", due_date: null, paid_date: "2026-08-02", notes: null, client_id: null, project_id: null, client_name: "India client", project_title: null, contract_id: null, contract_title: null, created_at: "2026-08-01", items: [] },
        ],
      });
    }
    if (pathname === "/api/workflow/clients") return json(route, { success: true, clients: [] });
    if (pathname === "/api/workflow/projects") return json(route, { success: true, projects: [] });
    if (pathname === "/api/notifications") return json(route, { success: true, notifications: [] });
    return json(route, { success: true });
  });
}

test("mixed invoices use a persistent display currency without changing native amounts", async ({ page }) => {
  test.setTimeout(60_000);
  await mockCurrencyWorkspace(page);
  await page.goto("/workflow/revenue", { waitUntil: "domcontentloaded" });

  const selector = page.getByLabel("Display currency").last();
  await expect(selector).toHaveValue("INR", { timeout: 20_000 });
  await expect(page.getByText("Multiple currencies")).toHaveCount(0);
  await expect(page.getByText(/₹16,600\.00/)).toBeVisible();
  await expect(page.getByText(/Originally \$100\.00/)).toBeVisible();

  await selector.selectOption("USD");
  await expect(selector).toHaveValue("USD");
  await expect(page.getByText("$200.00", { exact: true })).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Display currency").last()).toHaveValue("USD", { timeout: 20_000 });
});
