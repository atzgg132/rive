import { expect, test, type Page } from "@playwright/test";

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
    if (url.pathname === "/api/workflow/contracts/contract-1") return json({ success: false, message: "Mock handoff reached." }, 404);
    return json({ success: true });
  });
  return () => command;
}

test("creates an Agreement-and-invoice engagement from one three-step composer", async ({ page }) => {
  const readCommand = await installMocks(page);
  await page.goto("/workflow/start-engagement", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Start a client engagement" })).toBeVisible();
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
  await page.getByLabel("Invoice due date").fill("2026-09-20");
  await expect(page.getByText("Editable Agreement draft", { exact: true })).toBeVisible();
  await expect(page.getByText("Draft invoice", { exact: true })).toBeVisible();
  const createResponse = page.waitForResponse((response) => response.url().includes("/api/workflow/start-engagement") && response.request().method() === "POST");
  await page.getByRole("main").getByRole("button", { name: "Start engagement" }).click();
  await expect((await createResponse).status()).toBe(201);

  await expect(page).toHaveURL(/\/workflow\/contracts\/contract-1\?from=engagement/);
  expect(readCommand()).toMatchObject({
    entryPoint: "workspace",
    client: { mode: "new", name: "Northstar Labs", email: "hello@northstar.example" },
    project: { title: "Website redesign", scope: "Design and build the launch site." },
    milestone: { title: "Design approval", dueDate: "2026-09-15" },
    scopeMode: "agreement",
    invoice: { amount: "1250.50", dueDate: "2026-09-20" },
  });
});
