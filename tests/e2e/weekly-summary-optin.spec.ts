import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

loadEnvConfig(process.cwd());

/**
 * The opt-in card for the weekly business summary email (issue #66, PR 5).
 *
 * Eligibility ("has this been shown before") lives entirely behind
 * `GET/POST /api/workflow/weekly-summary/prompt`, which this spec mocks with
 * in-memory state per test — the same pattern `activation-ui.spec.ts` uses for
 * the guided-experience card, kept self-contained here rather than imported
 * so this spec has no dependency on that file's internal (unexported)
 * helpers.
 */

type PromptState = { shown: boolean; dismissedAt: string | null; respondedAt: string | null };

function dashboardPayload() {
  return {
    success: true,
    stats: { totalPaid: 0, totalPending: 0, activeProjects: 0, totalExpenses: 0, netEarnings: 0 },
    topClients: [],
    signals: [],
    periods: {
      month: { cashIn: 0, expensesOut: 0, net: 0, prior: { cashIn: 0, expensesOut: 0, net: 0 }, priorLabel: "Last month", dayOfMonth: 1 },
      sixMonths: { cashIn: 0, expensesOut: 0, net: 0, prior: { cashIn: 0, expensesOut: 0, net: 0 } },
      all: { cashIn: 0, expensesOut: 0, net: 0 },
    },
    chartPace: null,
    chartData: [],
    // guidanceDismissed: true keeps ActivationCard off screen so it never
    // competes with the weekly-summary card for the same slot.
    activation: {
      goal: "organize",
      goalLabel: "Organize client work",
      outcome: "Keep the next useful step clear.",
      startingPath: "quickstart",
      activationStage: "build",
      stageLabel: "Build your next useful step",
      recommendedAction: { id: "first_client", label: "Add your first client", description: "Add your first client in this workspace.", href: "/workflow/clients?new=true" },
      secondaryActions: [],
      milestones: [],
      completed: 0,
      total: 3,
      percentage: 0,
      guidanceDismissed: true,
      guidanceCompleted: false,
      automaticGuidanceStatus: "dismissed",
      hasMeaningfulContext: false,
      unresolvedImportIssues: 0,
      calendarConnectionCount: 0,
      guideProgress: {},
      counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 },
      steps: [],
      next: null,
    },
    profileReadiness: { completed: 0, total: 6, percentage: 0, substantial: false, signals: [] },
    insights: { collectionRate: 0, profitMargin: 0, overdueCount: 0, overdueAmount: 0, topExpenseCategory: null, topExpenseAmount: 0, upcomingProjects: [] },
    currency: { displayCurrency: "USD", ratesAsOf: null, conversionAvailable: true },
  };
}

async function installMocks(page: Page, promptState: PromptState, weeklySummaryEnabled: { value: boolean }) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/auth/session") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: { id: "wsummary-test-user", name: "Wren Summary", email: "wsummary@rive.test", plan: "free", onboarding_status: "complete", display_currency: "USD" },
          featureAvailability: { agreements: true, engagementFlow: true },
        }),
      });
    }
    if (pathname === "/api/activation" || pathname === "/api/workflow/dashboard") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dashboardPayload()) });
    }
    if (pathname === "/api/workflow/weekly-summary/prompt") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown> | null;
        promptState.dismissedAt = new Date().toISOString();
        if (body?.action === "accepted") promptState.respondedAt = new Date().toISOString();
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      }
      const available = !promptState.shown;
      promptState.shown = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, available }) });
    }
    if (pathname === "/api/workflow/weekly-summary") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown> | null;
        weeklySummaryEnabled.value = Boolean(body?.enabled);
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, enabled: weeklySummaryEnabled.value }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, enabled: weeklySummaryEnabled.value, lastSentAt: null }) });
    }
    if (pathname === "/api/notifications") {
      if (request.method() === "PATCH") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, notifications: [] }) });
    }
    if (pathname === "/api/rates") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { base: "USD", date: "2026-09-24", rates: { USD: 1 } } }) });
    if (pathname === "/api/workflow/contracts") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, contracts: [] }) });
    if (pathname === "/api/calendar/events") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, events: [] }) });
    if (pathname === "/api/calendar/calendars") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, calendars: [] }) });
    if (pathname === "/api/calendar/tasks") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, tasks: [] }) });
    if (pathname === "/api/portfolio") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, portfolio: { id: "portfolio", slug: "wsummary-tester", status: "draft", content: { headline: "", bio: "", services: [], projects: [], contactEmail: "", location: "" }, theme: {}, seo: null, revision: 1, templateKey: "minimal-pro" } }) });
    return route.continue();
  });
}

test.describe("weekly summary opt-in card", () => {
  test("shows once on the dashboard, offers to turn the summary on, and confirms", async ({ page }) => {
    const promptState: PromptState = { shown: false, dismissedAt: null, respondedAt: null };
    const weeklySummaryEnabled = { value: false };
    await installMocks(page, promptState, weeklySummaryEnabled);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const card = page.getByTestId("weekly-summary-optin-card");
    await expect(card).toBeVisible();
    await expect(card.getByText("Want a Monday morning summary?")).toBeVisible();

    await card.getByRole("button", { name: "Turn on" }).click();
    await expect(card.getByText("Weekly summaries are on.")).toBeVisible();
    expect(weeklySummaryEnabled.value).toBe(true);
  });

  test("dismissing hides it, and it does not come back after a reload", async ({ page }) => {
    const promptState: PromptState = { shown: false, dismissedAt: null, respondedAt: null };
    const weeklySummaryEnabled = { value: false };
    await installMocks(page, promptState, weeklySummaryEnabled);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const card = page.getByTestId("weekly-summary-optin-card");
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Not now" }).click();
    await expect(card).toBeHidden();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("weekly-summary-optin-card")).toHaveCount(0);
    expect(weeklySummaryEnabled.value).toBe(false);
  });

  test("never appears for a returning visit once the prompt has already been recorded as shown", async ({ page }) => {
    const promptState: PromptState = { shown: true, dismissedAt: new Date().toISOString(), respondedAt: null };
    const weeklySummaryEnabled = { value: false };
    await installMocks(page, promptState, weeklySummaryEnabled);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByTestId("weekly-summary-optin-card")).toHaveCount(0);
  });
});

test.describe("weekly summary unsubscribe link", () => {
  test.skip(!process.env.DATABASE_URL, "Requires DATABASE_URL with a migrated test database.");

  test("opening the link changes nothing; confirming turns the summary off", async ({ page, request }) => {
    const connectionString = new URL(process.env.DATABASE_URL!);
    for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) connectionString.searchParams.delete(parameter);
    const pool = new Pool({ connectionString: connectionString.toString(), ssl: false });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const user = await prisma.user.create({
      data: { email: `wsummary-${randomUUID()}@rive.test`, passwordHash: "scrypt:unused:unused", weeklySummaryEnabled: true },
      select: { id: true, email: true },
    });
    try {
      const token = randomBytes(32).toString("base64url");
      await prisma.authToken.create({
        data: {
          email: user.email,
          userId: user.id,
          type: "weekly_summary_unsubscribe",
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const url = `/api/public/weekly-summary/unsubscribe?token=${token}`;

      expect((await request.get(url)).status()).toBe(200);
      expect((await prisma.user.findUnique({ where: { id: user.id } }))?.weeklySummaryEnabled).toBe(true);

      await page.goto(url);
      await page.getByRole("button", { name: "Turn off weekly summaries" }).click();
      await expect(page.getByText("You’re unsubscribed.")).toBeVisible();
      expect((await prisma.user.findUnique({ where: { id: user.id } }))?.weeklySummaryEnabled).toBe(false);

      // Used once; the link now reads as expired.
      expect((await request.get(url)).status()).toBe(400);
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      await prisma.$disconnect();
      await pool.end();
    }
  });
});
