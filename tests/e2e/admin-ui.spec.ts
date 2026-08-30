import { expect, test, type Route } from "@playwright/test";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

const productFunnel = {
  definitionVersion: "v1",
  generatedAt: new Date().toISOString(),
  signups: { total: 10, verified: 8, last24h: 1, last7d: 3, daily: Array.from({ length: 14 }, (_, index) => ({ day: `2026-08-${String(index + 1).padStart(2, "0")}`, count: index === 13 ? 1 : 0 })) },
  qualification: { qualified: 4, rate: 40, sourceBreakdown: [{ source: "direct", signups: 10, qualified: 4 }] },
  activation: { activated: 1, rate: 25, native: 1, migration: 0, portfolio: 0, pathBreakdown: [{ path: "native", count: 1 }] },
  engagement: {
    prospectiveSince: "2026-08-30T00:00:00.000Z",
    createdUsers: 1,
    createdFlows: 1,
    medianHoursToCreate: 0.4,
    p75HoursToCreate: 0.4,
    firstSession: { completed: 1, started: 2, rate: 50 },
    sevenDay: { completed: 1, eligible: 2, rate: 50 },
    followThrough: { users: 1, eligible: 1, rate: 100 },
    steps: [
      { step: "client", users: 2, flows: 2 },
      { step: "work", users: 1, flows: 1 },
      { step: "setup", users: 1, flows: 1 },
    ],
    failures: [],
  },
  deepActivation: { deeplyActivated: 0, rateAmongActivated: 0, averageModules: 1.2, usersWithTwoActiveDays: 1, connectedWorkflows: 1 },
  realData: { users: 5, records: 12 },
  activeUsers: { wau: 2, mau: 3 },
  retention: { available: false, numerator: 0, denominator: 0, rate: null, definition: "Qualified users active in days 7–13 after signup, among cohorts at least 14 days old." },
  workflowDepth: { averageModules: 1.2, buckets: [{ label: "0–1 modules", count: 3 }, { label: "2 modules", count: 1 }, { label: "3+ modules", count: 0 }] },
  reliability: { productEvents24h: 9, failedEmails24h: 0, queuedEmails: 0 },
  window: { label: "all_customer_accounts", signupSparklineDays: 14, activationWindowDays: 7, deepActivationWindowDays: 14 },
  dropOff: {
    unqualified: 6,
    qualifiedNotActivated: 3,
    blockerCounts: [
      { blocker: "qualification:missing_goal", count: 3 },
      { blocker: "activation:no_linked_project_in_window", count: 2 },
    ],
  },
  quality: {
    schemaVersion: 1,
    contractRejections24h: 0,
    unknownEventNames24h: 0,
    missingIdentityEvents24h: 0,
    missingDataOriginEvents24h: 0,
    unknownOriginRecords: 0,
    latestEventAt: new Date().toISOString(),
    eventLagMinutes: 2,
    uncapturedSignups: 0,
    uncapturedSignupRate: 0,
    alerts: [],
  },
};

test.describe("admin control room", () => {
  test("keeps the admin login primary action usable", async ({ page }) => {
    await page.route("**/api/admin/session", (route) =>
      json(route, { success: false }, 401),
    );

    await page.goto("/admin");

    const signIn = page.getByRole("button", { name: "Sign in securely" });
    await expect(signIn).toBeVisible();
    await expect(signIn).toBeEnabled();
    await expect(signIn).toHaveClass(/bg-primary/);
  });

  test("shows a retryable state when funnel analytics are unavailable", async ({
    page,
  }) => {
    await page.route("**/api/admin/session", (route) =>
      json(route, { success: true }),
    );
    await page.route("**/api/admin/analytics", (route) =>
      json(route, {
        success: true,
        data: {
          productFunnel: null,
          productFunnelStatus: "unavailable",
        },
      }),
    );
    await page.route("**/api/admin/users*", (route) =>
      json(route, { success: true, data: [] }),
    );

    await page.goto("/admin");

    await expect(
      page.getByRole("alert").filter({ hasText: "This admin data is" }),
    ).toContainText(
      "temporarily unavailable",
    );
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Users" })).toBeVisible();

    await page.getByRole("button", { name: "Users" }).click();
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  });

  test("names the actual all-time window instead of last 14 days", async ({ page }) => {
    await page.route("**/api/admin/session", (route) => json(route, { success: true }));
    await page.route("**/api/admin/analytics", (route) => json(route, { success: true, data: { productFunnel } }));

    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "All customer accounts" })).toBeVisible();
    await expect(page.getByText("Last 14 days")).toHaveCount(0);
    await expect(page.getByText(/rolling 24h/)).toBeVisible();
    await expect(page.getByText(/Definitions v1/)).toBeVisible();
  });

  test("shows funnel drop-off reasons", async ({ page }) => {
    await page.route("**/api/admin/session", (route) => json(route, { success: true }));
    await page.route("**/api/admin/analytics", (route) => json(route, { success: true, data: { productFunnel } }));

    await page.goto("/admin");
    await page.getByRole("button", { name: "Funnel" }).click();

    await expect(page.getByRole("heading", { name: "Why they stop" })).toBeVisible();
    await expect(page.getByText("No primary goal")).toBeVisible();
    await expect(page.getByText("No client-linked project in 7 days")).toBeVisible();
  });

  test("shows registered real-data users and funnel diagnosis", async ({ page }) => {
    await page.route("**/api/admin/session", (route) => json(route, { success: true }));
    await page.route("**/api/admin/analytics", (route) => json(route, { success: true, data: { productFunnel } }));
    await page.route("**/api/admin/users?*", (route) =>
      json(route, {
        success: true,
        total: 1,
        data: [{
          id: "user-1",
          email: "bhargav8517@gmail.com",
          name: "Bhargav",
          createdAt: "2026-08-01T00:00:00.000Z",
          emailVerified: true,
          onboardingStatus: "complete",
          businessType: null,
          profession: null,
          goal: null,
          startingPath: "skipped",
          qualified: false,
          activated: false,
          stage: "registered",
          realData: true,
          qualificationBlockers: ["missing_goal", "missing_profession"],
          activationPaths: ["native"],
          attribution: { firstTouchSource: "google", lastTouchSource: "google", firstTouchMedium: "oauth", firstTouchCampaign: null, referralSource: null },
          lastActivity: { at: "2026-08-10T00:00:00.000Z", eventName: "project_created", module: "projects" },
        }],
      }),
    );
    await page.route("**/api/admin/users/user-1", (route) =>
      json(route, {
        success: true,
        user: { email: "bhargav8517@gmail.com" },
        funnel: {
          stage: "registered",
          qualified: false,
          activated: false,
          realData: true,
          productGuidanceStage: "activated",
          qualificationBlockers: ["missing_goal", "missing_profession"],
          activation: { native: true, migration: false, portfolio: false, paths: ["native"], blockers: [] },
          workspace: { clients: 4, projects: 6, invoices: 2, expenses: 0, calendarEvents: 3, publishedPortfolios: 0 },
        },
        timeline: [],
      }),
    );

    await page.goto("/admin");
    await page.getByRole("button", { name: "Users" }).click();

    await expect(page.getByText("bhargav8517@gmail.com")).toBeVisible();
    await expect(page.getByText("Registered · Has real data")).toBeVisible();

    await page.getByText("bhargav8517@gmail.com").click();
    await expect(page.locator("p").filter({ hasText: "Funnel stage:" })).toContainText("Registered");
    await expect(page.getByText("Missing for qualification:")).toContainText("No primary goal");
    await expect(page.getByText("Native path would already count")).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "Product guidance:" })).toContainText("activated");
  });
});
