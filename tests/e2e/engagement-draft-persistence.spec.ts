import { expect, test, type Page } from "@playwright/test";

async function installMocks(page: Page) {
  let command: Record<string, unknown> | null = null;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/api/auth/session") return json({ success: true, user: { id: "draft-user", name: "Draft Tester", email: "draft@rive.test", plan: "free", onboarding_status: "complete", display_currency: "USD" }, featureAvailability: { agreements: true, engagementFlow: true } });
    if (url.pathname === "/api/workflow/clients") return json({ success: true, clients: [] });
    if (url.pathname === "/api/engagement-events") return json({ success: true });
    if (url.pathname === "/api/workflow/start-engagement") {
      command = request.postDataJSON() as Record<string, unknown>;
      return json({ success: true, records: { clientId: "client-1", projectId: "project-1" }, nextAction: { kind: "milestone_plan", href: "/dashboard", label: "Review the project" } }, 201);
    }
    if (url.pathname === "/api/activation") return json({ success: true, activation: null });
    if (url.pathname === "/api/notifications") return json({ success: true, notifications: [] });
    if (url.pathname === "/api/rates") return json({ success: true, data: { base: "USD", date: "2026-08-30", rates: { USD: 1 } } });
    return json({ success: true });
  });
  return () => command;
}

test("engagement draft survives a full reload mid-flow", async ({ page }) => {
  await installMocks(page);
  await page.goto("/workflow/start-engagement", { waitUntil: "domcontentloaded" });

  await page.getByLabel("Client name").fill("Northstar Labs");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Project name").fill("Website redesign");
  await page.getByLabel("Project deadline").fill("2026-12-01");
  await page.getByLabel("First milestone").fill("Design approval");
  await page.getByLabel("Milestone due date").fill("2026-09-15");

  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByLabel("Project name")).toHaveValue("Website redesign");
  await expect(page.getByLabel("Project deadline")).toHaveValue("2026-12-01");
  await expect(page.getByLabel("First milestone")).toHaveValue("Design approval");
  await expect(page.getByLabel("Milestone due date")).toHaveValue("2026-09-15");
});

test("back navigation preserves values entered on earlier steps", async ({ page }) => {
  await installMocks(page);
  await page.goto("/workflow/start-engagement", { waitUntil: "domcontentloaded" });

  await page.getByLabel("Client name").fill("Northstar Labs");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Project name").fill("Website redesign");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("main").getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("Website redesign");
  await page.getByRole("main").getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Client name")).toHaveValue("Northstar Labs");
});

test("an engagement submits with no milestone and an independent deadline", async ({ page }) => {
  const readCommand = await installMocks(page);
  await page.goto("/workflow/start-engagement", { waitUntil: "domcontentloaded" });

  await page.getByLabel("Client name").fill("Northstar Labs");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Project name").fill("Website redesign");
  await page.getByLabel("Project deadline").fill("2026-12-01");
  await page.getByRole("button", { name: "Continue" }).click();

  const createResponse = page.waitForResponse((response) => response.url().includes("/api/workflow/start-engagement") && response.request().method() === "POST");
  await page.getByRole("main").getByRole("button", { name: "New client work" }).click();
  await expect((await createResponse).status()).toBe(201);

  const command = readCommand();
  expect(command?.milestone).toBeNull();
  expect(command?.project).toMatchObject({ title: "Website redesign", deadline: "2026-12-01" });
  await expect(page).toHaveURL(/\/dashboard/);
});
