import { expect, test, type Page, type Route } from "@playwright/test";

const invoice = {
  id: "invoice-1",
  invoice_number: "INV-1042",
  status: "sent",
  currency: "USD",
  subtotal: "2500",
  discount_rate: "0",
  discount_amount: "0",
  tax_rate: "0",
  tax_amount: "0",
  total: "2500",
  amount_paid: "0",
  outstanding: "2500",
  issue_date: "2026-08-01T00:00:00.000Z",
  due_date: "2026-08-15T00:00:00.000Z",
  paid_date: null,
  sent_at: "2026-08-01T00:00:00.000Z",
  reviewed_at: null,
  viewed_at: null,
  voided_at: null,
  notes: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  client_id: "client-1",
  project_id: "project-1",
  client_name: "Northstar Studio",
  client_company: null,
  client_email: "billing@northstar.test",
  project_title: "Launch site",
  contract_id: null,
  contract_title: null,
  items: [],
  payments: [],
  events: [],
};

function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockInvoiceNavigationWorkspace(page: Page) {
  const invoiceSearches: string[] = [];

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/auth/session") {
      return json(route, {
        success: true,
        user: { id: "nav-user", name: "Navigation Tester", email: "navigation@rive.test", plan: "free", onboarding_status: "complete", display_currency: "USD" },
        featureAvailability: { agreements: false },
      });
    }
    if (pathname === "/api/rates") return json(route, { success: true, data: { base: "USD", date: "2026-08-15", rates: { USD: 1 } } });
    if (pathname === "/api/workflow/clients/client-1") {
      return json(route, {
        success: true,
        client: {
          id: "client-1",
          name: "Northstar Studio",
          company: null,
          avatarColor: "#2563eb",
          createdAt: "2026-01-01T00:00:00.000Z",
          status: "active",
          email: "billing@northstar.test",
          phone: null,
          website: null,
          tags: [],
          ltv: 0,
          paid_revenue_by_currency: {},
          related_counts: { projects: 1, invoices: 1, contracts: 0 },
          notes: null,
          projects: [],
          invoices: [{ id: invoice.id, invoiceNumber: invoice.invoice_number, issueDate: invoice.issue_date, total: invoice.total, currency: invoice.currency, status: invoice.status }],
          contracts: [],
        },
      });
    }
    if (pathname === "/api/workflow/invoices/invoice-1") return json(route, { success: true, invoice });
    if (pathname === "/api/workflow/invoices") {
      const search = new URL(route.request().url()).searchParams.get("search") || "";
      if (search) invoiceSearches.push(search);
      return json(route, {
        success: true,
        invoices: search ? [invoice] : [],
        pagination: { page: 1, pageSize: 10, total: search ? 1 : 0, totalPages: search ? 1 : 0, hasNextPage: false, hasPreviousPage: false },
      });
    }
    if (pathname === "/api/workflow/clients") return json(route, { success: true, clients: [] });
    if (pathname === "/api/workflow/projects") return json(route, { success: true, projects: [] });
    return json(route, { success: true, available: false, notifications: [], activation: null });
  });

  return { invoiceSearches };
}

test("billing history links directly to its invoice", async ({ page }) => {
  await mockInvoiceNavigationWorkspace(page);
  await page.goto("/workflow/clients/client-1", { waitUntil: "domcontentloaded" });

  await page.getByRole("link", { name: "View invoice INV-1042" }).click();

  await expect(page).toHaveURL(/\/workflow\/invoices\/invoice-1$/);
  await expect(page.getByRole("heading", { name: "INV-1042" })).toBeVisible();
});

for (const [search, field] of [
  ["INV-1042", "invoice number"],
  ["Northstar Studio", "client"],
  ["Launch site", "project"],
] as const) {
  test(`command palette finds an invoice by ${field}`, async ({ page }) => {
    const { invoiceSearches } = await mockInvoiceNavigationWorkspace(page);
    await page.goto("/workflow/clients/client-1", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Search workspace/ }).click();

    await page.getByPlaceholder("Search features, commands, or settings...").fill(search);
    const result = page.getByRole("option", { name: new RegExp(invoice.invoice_number) });
    await expect(result).toBeVisible();
    expect(invoiceSearches).toContain(search);

    await result.click();
    await expect(page).toHaveURL(/\/workflow\/invoices\/invoice-1$/);
    await expect(page.getByRole("heading", { name: "INV-1042" })).toBeVisible();
  });
}
