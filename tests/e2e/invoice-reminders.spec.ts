import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

/**
 * Invoice reminders and paid receipts (#66 PR 2), end to end against the
 * database: settings, the first-send offer, a real reminder send through the
 * cron, the client's unsubscribe page, and owner scoping.
 */

loadEnvConfig(process.cwd());

const enabled = Boolean(process.env.DATABASE_URL && process.env.CRON_SECRET);
const sessionSecret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-development-session-secret";
const DAY_MS = 24 * 60 * 60 * 1000;

let prisma: PrismaClient;
let pool: Pool;

type TestUser = { id: string; email: string; plan: string; sessionVersion: number };
type JsonObject = Record<string, unknown>;

function sessionToken(user: TestUser) {
  const payload = JSON.stringify({ userId: user.id, email: user.email, plan: user.plan, sessionVersion: user.sessionVersion, expiry: Date.now() + DAY_MS });
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

function auth(user: TestUser) {
  return { Cookie: `rive_session=${sessionToken(user)}`, "Content-Type": "application/json" };
}

async function json(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<JsonObject> {
  return (await response.json()) as JsonObject;
}

async function createUser(label: string): Promise<TestUser> {
  return prisma.user.create({
    data: {
      email: `reminders-${label}-${randomUUID()}@rive.test`,
      name: `Reminders ${label}`,
      passwordHash: "scrypt:unused:unused",
      plan: "free",
      onboardingStatus: "complete",
      currency: "USD",
      timeZone: "UTC",
    },
    select: { id: true, email: true, plan: true, sessionVersion: true },
  });
}

async function createSentInvoice(request: APIRequestContext, user: TestUser, dueDate: string) {
  const clientResponse = await request.post("/api/workflow/clients", {
    headers: auth(user),
    data: { name: "Reminder client", email: `reminder-client-${randomUUID()}@example.com`, tags: [] },
  });
  expect(clientResponse.status()).toBe(201);
  const client = (await json(clientResponse)).client as JsonObject;
  const invoiceResponse = await request.post("/api/workflow/invoices", {
    headers: auth(user),
    data: {
      invoice_number: `REM-${randomUUID().slice(0, 8)}`,
      client_id: client.id,
      currency: "USD",
      due_date: dueDate,
      items: [{ description: "Reminder coverage", quantity: 1, unit_price: 200 }],
    },
  });
  expect(invoiceResponse.status()).toBe(201);
  const invoice = (await json(invoiceResponse)).invoice as JsonObject;
  const sendResponse = await request.post(`/api/workflow/invoices/${invoice.id}/send`, { headers: auth(user), data: { confirm: true } });
  expect(sendResponse.ok()).toBe(true);
  return { clientId: String(client.id), invoiceId: String(invoice.id), send: await json(sendResponse) };
}

function runCron(request: APIRequestContext) {
  return request.post("/api/cron/email-outbox", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
}

test.describe("invoice reminders", () => {
  test.skip(!enabled, "Requires DATABASE_URL and CRON_SECRET with a migrated test database.");
  test.setTimeout(90_000);

  test.beforeAll(async () => {
    const connectionString = new URL(process.env.DATABASE_URL!);
    for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) connectionString.searchParams.delete(parameter);
    pool = new Pool({ connectionString: connectionString.toString(), ssl: false });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  });

  test.afterAll(async () => {
    await prisma?.$disconnect();
    await pool?.end();
  });

  test("settings start off, reject unknown steps, persist, and show in Settings", async ({ request, page }) => {
    const user = await createUser("settings");
    try {
      const initial = await json(await request.get("/api/workflow/invoice-reminders/settings", { headers: auth(user) }));
      expect(initial.settings).toMatchObject({ remindersEnabled: false, paidReceiptEnabled: false });

      const invalid = await request.patch("/api/workflow/invoice-reminders/settings", { headers: auth(user), data: { reminderSchedule: ["due_plus_1", "every_hour"] } });
      expect(invalid.status()).toBe(400);

      const saved = await request.patch("/api/workflow/invoice-reminders/settings", {
        headers: auth(user),
        data: { remindersEnabled: true, reminderSchedule: ["due_plus_1", "due_plus_7"], paidReceiptEnabled: true },
      });
      expect(saved.ok()).toBe(true);
      const profile = await prisma.invoiceProfile.findUnique({ where: { userId: user.id } });
      expect(profile).toMatchObject({ remindersEnabled: true, reminderSchedule: ["due_plus_1", "due_plus_7"], paidReceiptEnabled: true });

      // The saved state shows in Settings -> Business & invoicing.
      const url = new URL(test.info().project.use.baseURL || "http://localhost:3000");
      await page.context().addCookies([{ name: "rive_session", value: sessionToken(user), domain: url.hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
      await page.goto("/settings#invoicing");
      const reminders = page.locator("#invoicing").getByRole("heading", { name: "Invoice reminders" });
      await expect(reminders).toBeVisible({ timeout: 30_000 });

      const anonymous = await request.get("/api/workflow/invoice-reminders/settings");
      expect(anonymous.status()).toBe(401);
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("the first send with a due date offers reminders once", async ({ request }) => {
    const user = await createUser("offer");
    try {
      const dueDate = new Date(Date.now() + 14 * DAY_MS).toISOString().slice(0, 10);
      const first = await createSentInvoice(request, user, dueDate);
      expect(first.send.offerReminders).toBe(true);
      const stored = await prisma.invoice.findUnique({ where: { id: first.invoiceId }, select: { publicTokenEncrypted: true, publicTokenHash: true } });
      expect(stored?.publicTokenHash).toBeTruthy();
      expect(stored?.publicTokenEncrypted).toBeTruthy();

      const dismissed = await request.post("/api/workflow/invoice-reminders/prompt", { headers: auth(user), data: { action: "dismiss" } });
      expect(dismissed.ok()).toBe(true);

      const second = await createSentInvoice(request, user, dueDate);
      expect(second.send.offerReminders).toBe(false);
      expect((await prisma.invoiceProfile.findUnique({ where: { userId: user.id } }))?.remindersEnabled).toBe(false);
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("the cron sends one due reminder, never twice, and a client unsubscribe stops the next", async ({ request, page }) => {
    const user = await createUser("send");
    const stranger = await createUser("stranger");
    try {
      const { clientId, invoiceId } = await createSentInvoice(request, user, new Date(Date.now() + 14 * DAY_MS).toISOString().slice(0, 10));
      await request.post("/api/workflow/invoice-reminders/prompt", { headers: auth(user), data: { action: "enable" } });

      // Back-date so "1 day after due" has arrived and the send predates it.
      await prisma.invoice.update({ where: { id: invoiceId }, data: { sentAt: new Date(Date.now() - 10 * DAY_MS), dueDate: new Date(Date.now() - DAY_MS) } });

      // Another owner cannot pause this invoice.
      const foreignPause = await request.patch(`/api/workflow/invoices/${invoiceId}/reminders`, { headers: auth(stranger), data: { paused: true } });
      expect(foreignPause.status()).toBe(404);

      expect((await runCron(request)).ok()).toBe(true);
      await expect.poll(() => prisma.invoiceReminder.findMany({ where: { invoiceId }, select: { step: true } })).toEqual([{ step: "due_plus_1" }]);

      // Same day, same step: a second run sends nothing more.
      expect((await runCron(request)).ok()).toBe(true);
      expect(await prisma.invoiceReminder.count({ where: { invoiceId } })).toBe(1);

      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { remindersUnsubscribeTokenHash: true, remindersUnsubscribeTokenEncrypted: true } });
      expect(client?.remindersUnsubscribeTokenHash).toBeTruthy();
      expect(client?.remindersUnsubscribeTokenEncrypted).toBeTruthy();

      // Swap in a token this test knows, then unsubscribe the way a client would.
      const token = randomBytes(32).toString("base64url");
      await prisma.client.update({ where: { id: clientId }, data: { remindersUnsubscribeTokenHash: createHash("sha256").update(token).digest("hex") } });
      const url = `/api/public/invoice-reminders/unsubscribe/${token}`;

      // Opening the link (or a scanner prefetching it) changes nothing.
      const preview = await request.get(url);
      expect(preview.status()).toBe(200);
      expect((await prisma.client.findUnique({ where: { id: clientId } }))?.remindersOptedOut).toBe(false);

      await page.goto(url);
      await page.getByRole("button", { name: "Stop reminder emails" }).click();
      await expect(page.getByText("You will no longer receive automated invoice reminders")).toBeVisible();
      expect((await prisma.client.findUnique({ where: { id: clientId } }))?.remindersOptedOut).toBe(true);

      // "7 days after due" arrives, but the client opted out.
      await prisma.invoice.update({ where: { id: invoiceId }, data: { dueDate: new Date(Date.now() - 8 * DAY_MS) } });
      expect((await runCron(request)).ok()).toBe(true);
      expect(await prisma.invoiceReminder.count({ where: { invoiceId } })).toBe(1);

      const unknown = await request.get(`/api/public/invoice-reminders/unsubscribe/${randomBytes(32).toString("base64url")}`);
      expect(unknown.status()).toBe(404);
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: stranger.id } }).catch(() => undefined);
    }
  });
});
