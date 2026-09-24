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
    timedUsers: 1,
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
  reliability: {
    productEvents24h: 9,
    productEvents7d: 40,
    failedEmails24h: 0,
    queuedEmails: 0,
    migration: {
      sessions24h: 0,
      sessions7d: 0,
      completionRate24h: null,
      completionRate7d: null,
      failed24h: 0,
      recoveredRetries7d: 0,
      staleJobs: 0,
      assistanceBacklog: 0,
      p50AnalysisMinutes: null,
      p95AnalysisMinutes: null,
      p50CommitMinutes: null,
      p95CommitMinutes: null,
      dlqMessages: null,
      failures: [],
    },
  },
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

    await expect(page.getByRole("heading", { name: "Where users stop" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "New client work" })).toBeVisible();
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

  test("restores the section from the URL and keeps tab selection in it", async ({ page }) => {
    await page.route("**/api/admin/session", (route) => json(route, { success: true }));
    await page.route("**/api/admin/analytics", (route) => json(route, { success: true, data: { productFunnel } }));
    await page.route("**/api/admin/users?*", (route) => json(route, { success: true, total: 0, data: [] }));

    await page.goto("/admin?tab=users");
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();

    await page.getByRole("button", { name: "Funnel", exact: true }).click();
    await expect(page).toHaveURL(/[?&]tab=funnel/);
    await expect(page.getByRole("heading", { name: "Where users stop" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Where users stop" })).toBeVisible();
  });

  test("drills the Deeply activated card into the matching Users cohort", async ({ page }) => {
    await page.route("**/api/admin/session", (route) => json(route, { success: true }));
    await page.route("**/api/admin/analytics", (route) => json(route, { success: true, data: { productFunnel } }));
    const requested: string[] = [];
    await page.route("**/api/admin/users?*", (route) => {
      requested.push(route.request().url());
      return json(route, { success: true, total: 0, hasMore: false, facets: { all: 0, registered: 0, qualified: 0, activated: 0, deeply_activated: 0, unverified: 0, realData: 0 }, sources: [], data: [] });
    });

    await page.goto("/admin");
    await page.getByRole("link", { name: /Deeply activated/ }).first().click();

    await expect(page).toHaveURL(/tab=users&stage=deeply_activated/);
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
    await expect.poll(() => requested.some((url) => url.includes("stage=deeply_activated"))).toBe(true);
    await expect(page.getByRole("button", { name: /^Deeply activated/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("shows a loading state, not the error card, while metrics load", async ({ page }) => {
    await page.route("**/api/admin/session", (route) => json(route, { success: true }));
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/admin/analytics", async (route) => {
      await gate;
      await json(route, { success: true, data: { productFunnel } });
    });

    await page.goto("/admin");

    await expect(page.getByRole("status").filter({ hasText: "Loading metrics" })).toBeVisible();
    await expect(page.getByText("Metrics unavailable")).toHaveCount(0);
    await expect(page.getByText("temporarily unavailable")).toHaveCount(0);

    release();
    await expect(page.getByRole("heading", { name: "All customer accounts" })).toBeVisible();
  });

  test("compares signups against an empty prior week instead of hiding it", async ({ page }) => {
    await page.route("**/api/admin/session", (route) => json(route, { success: true }));
    await page.route("**/api/admin/analytics", (route) => json(route, { success: true, data: { productFunnel } }));

    await page.goto("/admin");

    await expect(page.getByText("0 in prior 7d")).toBeVisible();
    await expect(page.getByText("no prior week to compare")).toHaveCount(0);
  });

  test("scopes time to engagement to first flows after instrumentation", async ({ page }) => {
    await page.route("**/api/admin/session", (route) => json(route, { success: true }));
    await page.route("**/api/admin/analytics", (route) => json(route, { success: true, data: { productFunnel } }));

    await page.goto("/admin?tab=funnel");

    await expect(page.getByText(/first flow of 1 account that signed up after tracking began/)).toBeVisible();
    // 0.4h reads as minutes, not as a rounded-down fraction of an hour.
    await expect(page.getByText("24m", { exact: true })).toBeVisible();
    await expect(page.getByText(/P75 24m/)).toBeVisible();
    await expect(page.getByText(/counts completed New client flows/)).toBeVisible();
  });

  test("lists only the reliability caveats that currently apply", async ({ page }) => {
    await page.route("**/api/admin/session", (route) => json(route, { success: true }));
    let funnel = productFunnel;
    await page.route("**/api/admin/analytics", (route) => json(route, { success: true, data: { productFunnel: funnel } }));

    await page.goto("/admin?tab=reliability");
    await expect(page.getByText("All signals within normal range.")).toBeVisible();
    await expect(page.getByText("Emails are failing.")).toHaveCount(0);
    await expect(page.getByText("Contract rejects are non-zero.")).toHaveCount(0);

    funnel = {
      ...productFunnel,
      reliability: { ...productFunnel.reliability, failedEmails24h: 2 },
      quality: { ...productFunnel.quality, uncapturedSignups: 4, uncapturedSignupRate: 40 },
    };
    await page.reload();
    await expect(page.getByText("Emails are failing.")).toBeVisible();
    await expect(page.getByText("Uncaptured signup source is high.")).toBeVisible();
    await expect(page.getByText("Contract rejects are non-zero.")).toHaveCount(0);
    await expect(page.getByText("All signals within normal range.")).toHaveCount(0);
  });

  test("marks an account internal and refreshes the counts", async ({ page }) => {
    await page.route("**/api/admin/session", (route) => json(route, { success: true }));
    let analyticsRequests = 0;
    await page.route("**/api/admin/analytics", (route) => {
      analyticsRequests += 1;
      return json(route, { success: true, data: { productFunnel } });
    });
    const account = {
      id: "user-internal",
      accountType: "customer",
      email: "founder@example.com",
      name: "Founder",
      createdAt: "2026-08-01T00:00:00.000Z",
      emailVerified: true,
      onboardingStatus: "complete",
      businessType: "studio",
      profession: "designer",
      goal: null,
      startingPath: null,
      qualified: true,
      activated: true,
      deeplyActivated: false,
      stage: "activated",
      realData: true,
      qualificationBlockers: [],
      activationPaths: ["native"],
      attribution: null,
      lastActivity: null,
    };
    const listRequests: string[] = [];
    await page.route("**/api/admin/users?*", (route) => {
      listRequests.push(route.request().url());
      return json(route, { success: true, total: 1, hasMore: false, facets: { all: 1, registered: 0, qualified: 1, activated: 1, deeply_activated: 0, unverified: 0, realData: 1, internal: 0 }, sources: ["uncaptured"], data: [account] });
    });
    const patches: unknown[] = [];
    await page.route("**/api/admin/users/user-internal", (route) => {
      if (route.request().method() === "PATCH") {
        patches.push(route.request().postDataJSON());
        return json(route, { success: true, accountType: "internal", changed: true });
      }
      return json(route, {
        success: true,
        user: { email: account.email },
        funnel: { stage: "activated", qualified: true, activated: true, realData: true, productGuidanceStage: "activated", qualificationBlockers: [], activation: { native: true, migration: false, portfolio: false, paths: ["native"], blockers: [] }, workspace: { clients: 1, projects: 1, invoices: 0, expenses: 0, calendarEvents: 0, publishedPortfolios: 0 } },
        timeline: [],
      });
    });

    await page.goto("/admin?tab=users");
    await expect(page.getByRole("button", { name: /^Internal/ })).toBeVisible();
    await page.getByText("founder@example.com").click();
    await expect(page.locator("p").filter({ hasText: "Counted in metrics:" })).toContainText("Yes");

    const listsBefore = listRequests.length;
    const analyticsBefore = analyticsRequests;
    await page.getByRole("button", { name: "Mark as internal" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Marked as internal" })).toBeVisible();
    expect(patches).toEqual([{ accountType: "internal" }]);
    await expect(page.getByRole("button", { name: "Mark as customer" })).toBeVisible();
    await expect.poll(() => listRequests.length).toBeGreaterThan(listsBefore);
    await expect.poll(() => analyticsRequests).toBeGreaterThan(analyticsBefore);
  });
});
