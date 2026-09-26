import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";

/**
 * Settings (#66 PR 1) against a real database: the workspace default
 * currency and where it applies, business & invoicing, password and
 * sign-out-everywhere, and the old invoice-settings route.
 */

loadEnvConfig(process.cwd());

const enabled = Boolean(process.env.DATABASE_URL);
const sessionSecret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-development-session-secret";
const PASSWORD = "settings-e2e-password";

let prisma: PrismaClient;
let pool: Pool;

type TestUser = { id: string; email: string; plan: string; sessionVersion: number };
type JsonObject = Record<string, unknown>;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function sessionToken(user: TestUser, sessionVersion = user.sessionVersion) {
  const payload = JSON.stringify({ userId: user.id, email: user.email, plan: user.plan, sessionVersion, expiry: Date.now() + 24 * 60 * 60 * 1000 });
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

function auth(token: string) {
  return { Cookie: `rive_session=${token}`, "Content-Type": "application/json" };
}

async function json(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<JsonObject> {
  return (await response.json()) as JsonObject;
}

async function createUser(label: string): Promise<TestUser> {
  return prisma.user.create({
    data: {
      email: `settings-${label}-${randomUUID()}@rive.test`,
      name: `Settings ${label}`,
      passwordHash: hashPassword(PASSWORD),
      plan: "free",
      onboardingStatus: "complete",
      currency: "USD",
      timeZone: "UTC",
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true, plan: true, sessionVersion: true },
  });
}

async function authenticateBrowser(context: BrowserContext, baseURL: string, token: string) {
  const url = new URL(baseURL);
  await context.addCookies([{ name: "rive_session", value: token, domain: url.hostname, path: "/", httpOnly: true, secure: url.protocol === "https:", sameSite: "Lax" }]);
}

test.describe("settings", () => {
  test.skip(!enabled, "Requires DATABASE_URL with a migrated test database.");
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

  test("the workspace default currency applies to new records; a linked project's currency still wins", async ({ request }) => {
    const user = await createUser("currency");
    const headers = auth(sessionToken(user));
    try {
      expect((await request.get("/api/settings")).status()).toBe(401);

      const invalid = await request.patch("/api/settings/workspace", { headers, data: { currency: "EURO" } });
      expect(invalid.status()).toBe(400);
      const notIso = await request.patch("/api/settings/workspace", { headers, data: { currency: "ZZZ" } });
      expect(notIso.status()).toBe(400);
      const badZone = await request.patch("/api/settings/workspace", { headers, data: { timeZone: "Mars/Olympus" } });
      expect(badZone.status()).toBe(400);

      const saved = await request.patch("/api/settings/workspace", { headers, data: { currency: "EUR", timeZone: "Asia/Kolkata" } });
      expect(saved.ok()).toBe(true);
      const settings = await json(await request.get("/api/settings", { headers }));
      expect(settings.user).toMatchObject({ currency: "EUR", timeZone: "Asia/Kolkata" });

      const invoice = await request.post("/api/workflow/invoices", {
        headers,
        data: { invoice_number: `SET-${randomUUID().slice(0, 8)}`, items: [{ description: "Default currency", quantity: 1, unit_price: 10 }] },
      });
      expect(invoice.status()).toBe(201);
      expect(((await json(invoice)).invoice as JsonObject).currency).toBe("EUR");

      const expense = await request.post("/api/workflow/expenses", { headers, data: { description: "Default currency", amount: 12, category: "software" } });
      expect(expense.ok()).toBe(true);
      const storedExpense = await prisma.expense.findFirst({ where: { userId: user.id }, select: { currency: true } });
      expect(storedExpense?.currency).toBe("EUR");

      const project = await request.post("/api/workflow/projects", {
        headers,
        data: { title: "GBP project", currency: "GBP", status: "active", priority: "medium", tags: [], milestones: [] },
      });
      expect(project.status()).toBe(201);
      const projectId = ((await json(project)).project as JsonObject).id;
      const projectInvoice = await request.post("/api/workflow/invoices", {
        headers,
        data: { invoice_number: `SET-${randomUUID().slice(0, 8)}`, project_id: projectId, items: [{ description: "Project currency", quantity: 1, unit_price: 10 }] },
      });
      expect(projectInvoice.status()).toBe(201);
      expect(((await json(projectInvoice)).invoice as JsonObject).currency).toBe("GBP");
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("business & invoicing saves, validates payment terms, and the old page redirects", async ({ request, page, context, baseURL }) => {
    const user = await createUser("invoicing");
    const token = sessionToken(user);
    try {
      const invalid = await request.patch("/api/settings/invoicing", { headers: auth(token), data: { businessName: "Studio", defaultPaymentTermsDays: 400 } });
      expect(invalid.status()).toBe(400);

      const saved = await request.patch("/api/settings/invoicing", {
        headers: auth(token),
        data: { businessName: "Settings Studio", invoicePrefix: "SS", defaultPaymentTermsDays: 14 },
      });
      expect(saved.ok()).toBe(true);
      const profile = await prisma.invoiceProfile.findUnique({ where: { userId: user.id } });
      expect(profile).toMatchObject({ businessName: "Settings Studio", invoicePrefix: "SS", defaultPaymentTermsDays: 14 });

      await authenticateBrowser(context, baseURL!, token);
      await page.goto("/workflow/invoice-settings");
      await expect(page).toHaveURL(/\/settings#invoicing$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("#invoicing")).toBeVisible();
      await expect(page.locator("#invoicing input:visible").first()).toBeVisible();
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("changing the password and signing out everywhere end other sessions but keep this one", async ({ request }) => {
    const user = await createUser("security");
    const original = sessionToken(user);
    try {
      const wrong = await request.post("/api/settings/security/password", { headers: auth(original), data: { currentPassword: "not-it", newPassword: "a-new-password-1" } });
      expect(wrong.status()).toBe(400);

      const changed = await request.post("/api/settings/security/password", { headers: auth(original), data: { currentPassword: PASSWORD, newPassword: "a-new-password-1" } });
      expect(changed.ok()).toBe(true);
      expect((await request.get("/api/settings", { headers: auth(original) })).status()).toBe(401);
      const afterChange = sessionToken(user, user.sessionVersion + 1);
      expect((await request.get("/api/settings", { headers: auth(afterChange) })).status()).toBe(200);

      const signedOut = await request.post("/api/settings/security/sign-out-all", { headers: auth(afterChange) });
      expect(signedOut.ok()).toBe(true);
      expect((await request.get("/api/settings", { headers: auth(afterChange) })).status()).toBe(401);
      expect((await request.get("/api/settings", { headers: auth(sessionToken(user, user.sessionVersion + 2)) })).status()).toBe(200);

      const alerts = await request.patch("/api/settings/notifications", { headers: auth(sessionToken(user, user.sessionVersion + 2)), data: { loginAlertsEnabled: false } });
      expect(alerts.ok()).toBe(true);
      expect((await prisma.user.findUnique({ where: { id: user.id } }))?.loginAlertsEnabled).toBe(false);
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("sign out everywhere asks in a styled dialog, and the mobile menu fits a short screen", async ({ page, context, baseURL }) => {
    const user = await createUser("ui");
    try {
      await authenticateBrowser(context, baseURL!, sessionToken(user));
      await page.goto("/settings#security");
      await page.getByRole("button", { name: "Sign out everywhere else" }).click({ timeout: 30_000 });
      const dialog = page.getByRole("dialog", { name: "Sign out of every other device?" });
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      expect((await prisma.user.findUnique({ where: { id: user.id } }))?.sessionVersion).toBe(user.sessionVersion);

      await page.setViewportSize({ width: 375, height: 640 });
      await page.getByRole("button", { name: "Open navigation" }).click();
      const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
      const lastLink = drawer.getByRole("navigation", { name: "Mobile workspace navigation" }).getByRole("link").last();
      const settingsLink = drawer.getByRole("link", { name: "Settings" });
      await expect(settingsLink).toBeAttached();
      const linkBox = await lastLink.boundingBox();
      const settingsBox = await settingsLink.boundingBox();
      expect(linkBox && settingsBox).toBeTruthy();
      // The account block sits below the links instead of on top of them.
      expect(settingsBox!.y).toBeGreaterThanOrEqual(linkBox!.y + linkBox!.height);
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });
});
