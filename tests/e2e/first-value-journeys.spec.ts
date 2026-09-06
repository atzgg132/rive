/**
 * First-value browser journeys (W01/W04 acceptance: CH-02, CH-03, CH-07).
 *
 * Same gate as release-critical: DATABASE_URL for a migrated database and a
 * running app. Isolation is per unique owner, not a special database name —
 * verify only has rive_test, and a rive_w00 name lock skipped the journeys
 * there entirely.
 */
import { loadEnvConfig } from "@next/env";
import { expect, test, type BrowserContext } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes, scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { checkServerIdentity } from "node:tls";
import { Pool } from "pg";

loadEnvConfig(process.cwd());

const journeysEnabled = Boolean(process.env.DATABASE_URL);
const sessionSecret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-development-session-secret";
const EVIDENCE = join(process.cwd(), "test-results", "first-value-journeys");

function dbUrl(): string {
  const raw = process.env.DATABASE_URL || "";
  if (!raw) throw new Error("Journey specs need DATABASE_URL.");
  return raw;
}

function sslConfig() {
  const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
  return process.env.DATABASE_SSL === "disable" || process.env.DATABASE_URL?.includes("sslmode=disable")
    ? false
    : {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
        ...(sslServerName ? { checkServerIdentity: (_hostname: string, certificate: Parameters<typeof checkServerIdentity>[1]) => checkServerIdentity(sslServerName, certificate) } : {}),
      };
}

function journeyTag() {
  return `j${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
}

function tokenFor(user: { id: string; email: string; plan: string; sessionVersion: number }): string {
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ userId: user.id, email: user.email, plan: user.plan, sessionVersion: user.sessionVersion, expiry });
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

async function authenticate(context: BrowserContext, user: { id: string; email: string; plan: string; sessionVersion: number }, baseURL: string) {
  await context.addCookies([{
    name: "rive_session",
    value: tokenFor(user),
    domain: new URL(baseURL).hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

/** The feedback prompt pops up late on fresh workspaces and covers actions. */
async function dismissFeedback(page: import("@playwright/test").Page) {
  const notNow = page.getByRole("button", { name: "Not now" });
  try {
    await notNow.first().waitFor({ state: "visible", timeout: 12_000 });
    await notNow.first().click();
  } catch {
    // Never appeared — nothing covers the actions.
  }
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

test.describe("first-value journeys", () => {
  test.skip(!journeysEnabled, "Requires DATABASE_URL.");
  test.setTimeout(120_000);

  test.beforeAll(() => {
    mkdirSync(EVIDENCE, { recursive: true });
  });

  test("CH-02: fresh owner creates, reviews and issues a first invoice with no project", async ({ page, context, baseURL, request }) => {
    const stamp = journeyTag();
    const pool = new Pool({ connectionString: dbUrl(), ssl: sslConfig() });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    try {
      const email = `ch02-${stamp}@example.invalid`;
      const user = await prisma.user.create({
        data: {
          email, passwordHash: `scrypt:${randomBytes(8).toString("hex")}:${scryptSync("journey-pass-1", "salt", 64).toString("hex")}`,
          name: "CH02 Owner", currency: "USD", timeZone: "UTC", plan: "free",
          emailVerifiedAt: new Date(), onboardingStatus: "complete", onboardingStep: 7,
        },
      });
      await authenticate(context, { id: user.id, email, plan: "free", sessionVersion: 0 }, baseURL!);

      // Setup (not the asserted behavior): one client to bill.
      const clientName = `CH02 Bakery ${stamp}`;
      const clientRes = await request.post("/api/workflow/clients", {
        headers: { Cookie: `rive_session=${tokenFor({ id: user.id, email, plan: "free", sessionVersion: 0 })}`, "Content-Type": "application/json" },
        data: { name: clientName, email: `ch02-billing-${stamp}@example.invalid`, tags: [] },
      });
      expect(clientRes.status()).toBe(201);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/workflow/invoices/new");
      await expect(page.getByRole("heading", { name: "Create a polished invoice" })).toBeVisible();
      // No project ritual: the project selector offers and keeps "No project linked".
      await expect(page.getByLabel(/Project/)).toHaveValue("");
      await page.locator("select", { has: page.locator("option", { hasText: clientName }) }).selectOption({ label: clientName });
      await page.getByLabel("Line item 1 description").fill("CH02 brand sprint");
      await page.getByLabel("Line item 1 quantity").fill("2");
      await page.getByLabel("Line item 1 rate").fill("250");
      const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      await page.getByLabel("Due date").fill(due);
      // Dismiss any feedback prompt so it cannot steal keyboard focus.
      await dismissFeedback(page);
      // Keyboard-only path: Tab from the notes field until Save is focused, then Enter.
      await page.getByPlaceholder("Payment instructions, context, or a thank-you note").fill("Thanks for the sprint.");
      await expect.poll(async () => {
        await page.keyboard.press("Tab");
        return page.evaluate(() => {
          const active = document.activeElement;
          return active ? (active.textContent || "").trim().startsWith("Save") : false;
        });
      }, { timeout: 10_000 }).toBe(true);
      await page.screenshot({ path: join(EVIDENCE, "ch02-keyboard-focus.png") });
      const saveResponse = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/api/workflow/invoices"));
      await page.keyboard.press("Enter");
      const saved = await saveResponse;
      expect(saved.status()).toBe(201);
      const savedJson = await saved.json();
      const invoiceId = savedJson.invoice.id as string;
      await expect(page).toHaveURL(/\/workflow\/revenue/);
      await page.screenshot({ path: join(EVIDENCE, "ch02-draft-saved.png") });

      const draft = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(draft.projectId).toBeNull();
      expect(draft.status).toBe("draft");
      expect(draft.invoiceNumber).toBeTruthy();

      // Review the client-facing document.
      await page.goto(`/workflow/invoices/${invoiceId}`);
      await expect(page.getByText("CH02 brand sprint").first()).toBeVisible();
      await dismissFeedback(page);
      await page.screenshot({ path: join(EVIDENCE, "ch02-review.png") });

      // Issue from the revenue workspace row menu.
      await page.goto("/workflow/revenue");
      await dismissFeedback(page);
      await expect(page.getByText(draft.invoiceNumber).first()).toBeVisible({ timeout: 15_000 });
      await page.locator("tr", { hasText: draft.invoiceNumber }).getByRole("button", { name: "Open" }).click();
      const panel = page.getByRole("dialog", { name: `Invoice ${draft.invoiceNumber}` });
      await expect(panel.getByRole("button", { name: "Send", exact: true })).toBeVisible({ timeout: 15_000 });
      const sent = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/send"));
      await panel.getByRole("button", { name: "Send", exact: true }).click();
      expect((await sent).status()).toBe(200);
      await page.screenshot({ path: join(EVIDENCE, "ch02-issued.png") });

      const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(issued.status).toBe("sent");
      expect(issued.projectId).toBeNull();
    } finally {
      await prisma.$disconnect().catch(() => {});
      await pool.end().catch(() => {});
    }
  });

  test("CH-03: client work starts with no dates; milestone and deadline stay independent", async ({ page, context, baseURL, request }) => {
    const stamp = journeyTag();
    const pool = new Pool({ connectionString: dbUrl(), ssl: sslConfig() });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    try {
      const email = `ch03-${stamp}@example.invalid`;
      const user = await prisma.user.create({
        data: {
          email, passwordHash: `scrypt:x:${scryptSync("journey-pass-1", "salt", 64).toString("hex")}`,
          name: "CH03 Owner", currency: "USD", timeZone: "UTC", plan: "free",
          emailVerifiedAt: new Date(), onboardingStatus: "complete", onboardingStep: 7,
        },
      });
      const cookie = `rive_session=${tokenFor({ id: user.id, email, plan: "free", sessionVersion: 0 })}`;
      await authenticate(context, { id: user.id, email, plan: "free", sessionVersion: 0 }, baseURL!);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/workflow/start-engagement");
      await expect(page.getByRole("heading", { name: "New client work" })).toBeVisible();
      const clientName = `CH03 Studio ${stamp}`;
      await page.getByPlaceholder("Northstar Labs").fill(clientName);
      await page.getByPlaceholder("hello@northstar.example").fill(`ch03-${stamp}@example.invalid`);
      await page.getByRole("button", { name: "Continue" }).click();

      // Step 2: project name only — deadline and milestone stay empty.
      const projectTitle = `CH03 Retainer ${stamp}`;
      await page.getByPlaceholder("Website redesign").fill(projectTitle);
      await page.screenshot({ path: join(EVIDENCE, "ch03-undated-form.png") });
      // Reload: the draft (including its flow id) survives.
      await page.reload();
      await expect(page.getByPlaceholder("Website redesign")).toHaveValue(projectTitle);
      // Back-navigation preserves the model too.
      await page.goto("/dashboard");
      await page.goBack();
      await expect(page.getByPlaceholder("Website redesign")).toHaveValue(projectTitle);
      await page.getByRole("button", { name: "Continue" }).click();

      // Step 3: keep scope with the project, no invoice.
      await page.locator('section[aria-labelledby="start-engagement-heading"]')
        .getByRole("button", { name: "New client work", exact: true }).click();
      const created = await page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/api/workflow/start-engagement"));
      expect(created.status()).toBe(201);
      const createdJson = await created.json();
      const projectId = createdJson.records.projectId as string;
      await page.screenshot({ path: join(EVIDENCE, "ch03-created.png") });

      const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { milestones: true } });
      expect(project.dueDate).toBeNull();
      expect(project.milestones).toHaveLength(0);

      // Later: an undated milestone plus a separate project deadline stay independent.
      const auth = { Cookie: cookie, "Content-Type": "application/json" };
      const putRes = await request.put("/api/workflow/projects", {
        headers: auth,
        data: { id: projectId, title: projectTitle, new_milestones: [{ title: `CH03 kickoff ${stamp}` }] },
      });
      expect(putRes.status()).toBe(200);
      const deadline = "2026-12-18";
      const putRes2 = await request.put("/api/workflow/projects", {
        headers: auth,
        data: { id: projectId, title: projectTitle, due_date: deadline },
      });
      expect(putRes2.status()).toBe(200);

      const updated = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { milestones: true } });
      expect(updated.dueDate?.toISOString().slice(0, 10)).toBe(deadline);
      expect(updated.milestones).toHaveLength(1);
      expect(updated.milestones[0].dueDate).toBeNull();

      await page.goto(`/workflow/projects/${projectId}`);
      await expect(page.getByText(projectTitle).first()).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: join(EVIDENCE, "ch03-independent-dates.png") });
    } finally {
      await prisma.$disconnect().catch(() => {});
      await pool.end().catch(() => {});
    }
  });

  test("CH-07: split-month receipts, retry and double submit keep one logical payment", async ({ page, context, baseURL, request }) => {
    const stamp = journeyTag();
    const pool = new Pool({ connectionString: dbUrl(), ssl: sslConfig() });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    try {
      const email = `ch07-${stamp}@example.invalid`;
      const user = await prisma.user.create({
        data: {
          email, passwordHash: `scrypt:x:${scryptSync("journey-pass-1", "salt", 64).toString("hex")}`,
          name: "CH07 Owner", currency: "USD", timeZone: "UTC", plan: "free",
          emailVerifiedAt: new Date(), onboardingStatus: "complete", onboardingStep: 7,
        },
      });
      const session = { id: user.id, email, plan: "free", sessionVersion: 0 };
      const cookie = `rive_session=${tokenFor(session)}`;
      const auth = { Cookie: cookie, "Content-Type": "application/json" };
      await authenticate(context, session, baseURL!);

      const client = await prisma.client.create({
        data: { userId: user.id, name: `CH07 Mill ${stamp}`, email: `ch07-${stamp}@example.invalid`, tags: [] },
      });
      const invoice = await prisma.invoice.create({
        data: {
          userId: user.id, clientId: client.id, invoiceNumber: `CH07-${stamp}`, status: "sent",
          currency: "USD", subtotal: 1000, total: 1000, amountPaid: 0,
          issueDate: new Date(), dueDate: new Date(Date.now() + 14 * 86400000),
          items: { create: [{ description: "CH07 build", quantity: 1, unitPrice: 1000, amount: 1000, sortOrder: 0 }] },
        },
      });
      const pay = (amount: string, key: string, receivedOn?: string) =>
        request.post(`/api/workflow/invoices/${invoice.id}/payment`, {
          headers: { ...auth, "Idempotency-Key": key },
          data: receivedOn ? { amount, method: "manual", receivedOn } : { amount, method: "manual" },
        });

      // Two receipt months: the 15th of last month and yesterday.
      const now = new Date();
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
      const second = new Date(Date.now() - 86400000);
      const day1 = first.toISOString().slice(0, 10);
      const day2 = second.toISOString().slice(0, 10);
      expect(monthKey(first)).not.toBe(monthKey(second));

      const firstRes = await pay("400", `ch07-deposit-${stamp}`, day1);
      expect(firstRes.status()).toBe(201);
      // Concurrent duplicate POSTs: one payment row, one event.
      const [a, b] = await Promise.all([
        pay("600", `ch07-balance-${stamp}`, day2),
        pay("600", `ch07-balance-${stamp}`, day2),
      ]);
      expect(new Set([a.status(), b.status()])).toEqual(new Set([200, 201]));
      // Retry of the final payment on a later day without a date replays the original.
      const retry = await pay("600", `ch07-balance-${stamp}`);
      expect(retry.status()).toBe(200);
      expect((await retry.json()).duplicate).toBe(true);

      let rows = await prisma.invoicePayment.findMany({ where: { invoiceId: invoice.id }, orderBy: { paidAt: "asc" } });
      expect(rows).toHaveLength(2);
      expect(rows[0].paidAt.toISOString().slice(0, 10)).toBe(day1);
      expect(rows[1].paidAt.toISOString().slice(0, 10)).toBe(day2);
      const settled = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(settled.status).toBe("paid");
      expect(Number(settled.amountPaid)).toBe(1000);

      // Monthly cash on the overview matches the dated receipts.
      const dash = await request.get("/api/workflow/dashboard", { headers: { Cookie: cookie } });
      expect(dash.status()).toBe(200);
      const chart = ((await dash.json()).chartData || []) as Array<{ period: string; revenue: number }>;
      const byPeriod = new Map(chart.map((row) => [row.period, row.revenue]));
      expect(byPeriod.get(monthKey(first))).toBe(400);
      expect(byPeriod.get(monthKey(second))).toBe(600);

      // Mobile viewport for the settled invoice and refresh checks.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/workflow/invoices/${invoice.id}`);
      await expect(page.getByText("CH07 build").first()).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: join(EVIDENCE, "ch07-settled-mobile.png") });

      // Stale second tab: it loaded the invoice before any new activity; a
      // same-key submit still replays instead of double-recording.
      const secondContext = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
      const stale = await secondContext.newPage();
      await authenticate(secondContext, session, baseURL!);
      await stale.goto(`/workflow/invoices/${invoice.id}`);
      await expect(stale.getByText("CH07 build").first()).toBeVisible({ timeout: 15_000 });
      const staleRetry = await request.post(`/api/workflow/invoices/${invoice.id}/payment`, {
        headers: { ...auth, "Idempotency-Key": `ch07-balance-${stamp}` },
        data: { amount: "600", method: "manual" },
      });
      expect(staleRetry.status()).toBe(200);
      await secondContext.close();

      // Refresh keeps exactly two receipts with their original dates.
      await page.reload();
      await expect(page.getByText("CH07 build").first()).toBeVisible({ timeout: 15_000 });
      rows = await prisma.invoicePayment.findMany({ where: { invoiceId: invoice.id }, orderBy: { paidAt: "asc" } });
      expect(rows).toHaveLength(2);
      const events = await prisma.invoiceEvent.count({ where: { invoiceId: invoice.id } });
      expect(events).toBe(2);
      await page.screenshot({ path: join(EVIDENCE, "ch07-after-refresh.png") });
    } finally {
      await prisma.$disconnect().catch(() => {});
      await pool.end().catch(() => {});
    }
  });
});
