import { expect, test, type Page } from "@playwright/test";

function isoDaysFromToday(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  return errors;
}

async function installMocks(page: Page) {
  let command: Record<string, unknown> | null = null;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/api/auth/session") return json({ success: true, user: { id: "engagement-user", name: "Engagement Tester", email: "engagement@rive.test", plan: "free", onboarding_status: "complete", display_currency: "USD" }, featureAvailability: { agreements: true, engagementFlow: true } });
    if (url.pathname === "/api/workflow/clients") return json({ success: true, clients: [] });
    if (url.pathname === "/api/engagement-events") return json({ success: true });
    if (url.pathname === "/api/workflow/start-engagement") {
      command = request.postDataJSON() as Record<string, unknown>;
      return json({ success: true, records: { clientId: "client-1", projectId: "project-1", milestoneId: "milestone-1", contractId: "contract-1", invoiceId: "invoice-1" }, nextAction: { kind: "agreement_review", href: "/workflow/contracts/contract-1?from=engagement&edit=1&nextInvoiceId=invoice-1", label: "Review Agreement draft" } }, 201);
    }
    if (url.pathname === "/api/activation") return json({ success: true, activation: null });
    if (url.pathname === "/api/notifications") return json({ success: true, notifications: [] });
    if (url.pathname === "/api/rates") return json({ success: true, data: { base: "USD", date: "2026-08-30", rates: { USD: 1 } } });
    if (url.pathname === "/api/workflow/dashboard") return json({
      success: true,
      stats: { totalPaid: 0, totalPending: 0, activeProjects: 0, totalExpenses: 0, netEarnings: 0 },
      topClients: [], signals: [], chartData: [], activation: null, insights: null,
      currency: { displayCurrency: "USD", ratesAsOf: "2026-08-30", conversionAvailable: true },
    });
    if (url.pathname === "/api/workflow/contracts/contract-1") return json({
      success: true,
      contract: {
        id: "contract-1", title: "Website redesign Agreement", status: "draft", provider: "local",
        governing_law: "India", jurisdiction: "Karnataka", currency: "USD",
        finalized_at: null, executed_at: null, voided_at: null,
        void_requested_at: null, void_requested_by_role: null, void_request_note: null, void_confirm_note: null,
        client: { id: "client-1", name: "Northstar Labs", email: "hello@northstar.example", company: null, address: null },
        project: {
          id: "project-1", title: "Website redesign", description: "Design and build the launch site.",
          startDate: null, dueDate: null,
          milestones: [{ id: "milestone-1", title: "Design approval", dueDate: "2026-09-15", completed: false }],
        },
        versions: [{
          id: "version-1", version: 1, status: "draft", content_hash: "engagement-contract-hash",
          created_at: "2026-08-10T09:00:00.000Z", finalized_at: null, artifacts: [],
          content: {
            title: "Website redesign Agreement", ownerName: "Engagement Tester", ownerEmail: "engagement@rive.test",
            clientName: "Northstar Labs", clientEmail: "hello@northstar.example", clientCompany: null, clientAddress: null,
            projectTitle: "Website redesign", projectDescription: "Design and build the launch site.",
            governingLaw: "India", jurisdiction: "Karnataka",
            sections: [{ key: "scope", title: "Scope", body: "Design and build the launch site.", enabled: true }],
            paymentPlan: { currency: "USD", items: [{ id: "payment-1", label: "Project fee", amount: "1250.50", currency: "USD", triggerType: "on_signing", triggerDate: null, dueDays: 7, milestoneId: null, milestoneTitle: null, invoiceDescription: "Website redesign" }] },
          },
        }],
        signers: [], review_links: [], comments: [], events: [],
        payment_plan: [{ id: "payment-1", label: "Project fee", amount: "1250.50", currency: "USD", trigger_type: "on_signing", trigger_date: null, due_days: 7, invoice_description: "Website redesign", status: "scheduled", milestone: null, occurrence: null }],
        work_setup: { status: "not_started", accepted_version_id: null, preview_plan: null, preview_hash: null, result_ids: null, error: null },
      },
    });
    return json({ success: true });
  });
  return () => command;
}

test("creates an Agreement-and-invoice engagement from one three-step composer", async ({ page }) => {
  const errors = captureBrowserErrors(page);
  const readCommand = await installMocks(page);
  await page.goto("/workflow/start-engagement", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "New client work" })).toBeVisible();
  await page.getByLabel("Client name").fill("Northstar Labs");
  await page.getByLabel("Client email").fill("hello@northstar.example");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Project name").fill("Website redesign");
  await page.getByLabel("Scope summary").fill("Design and build the launch site.");
  await page.getByLabel("First milestone").fill("Design approval");
  await page.getByLabel("Milestone due date").fill("2026-09-15");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: /Create editable Agreement draft/ }).click();
  await page.getByRole("checkbox", { name: /Create a draft invoice/ }).check();
  await page.getByLabel("Amount (USD)").fill("1250.50");
  const invoiceDueDate = isoDaysFromToday(14);
  await page.getByLabel("Invoice due date").fill(invoiceDueDate);
  await expect(page.getByText("Editable Agreement draft", { exact: true })).toBeVisible();
  await expect(page.getByText("Draft invoice", { exact: true })).toBeVisible();
  const createResponse = page.waitForResponse((response) => response.url().includes("/api/workflow/start-engagement") && response.request().method() === "POST");
  await page.getByRole("main").getByRole("button", { name: "New client work" }).click();
  await expect((await createResponse).status()).toBe(201);

  await expect(page).toHaveURL(/\/workflow\/contracts\/contract-1\?from=engagement/);
  expect(readCommand()).toMatchObject({
    entryPoint: "workspace",
    client: { mode: "new", name: "Northstar Labs", email: "hello@northstar.example" },
    project: { title: "Website redesign", scope: "Design and build the launch site." },
    milestone: { title: "Design approval", dueDate: "2026-09-15" },
    scopeMode: "agreement",
    invoice: { amount: "1250.50", dueDate: invoiceDueDate },
  });
  expect(errors, "engagement flow emitted browser errors").toEqual([]);
});
