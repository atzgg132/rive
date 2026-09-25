import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHash, createHmac, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";
import { totpCode } from "../../src/utils/totp";

loadEnvConfig(process.cwd());

// Drives the real enroll -> sign out -> sign back in with a TOTP code -> sign
// back in with a recovery code flow against a real database, the same shape
// as release-critical.spec.ts. Requires a migrated DATABASE_URL, same as that
// suite: skipped otherwise rather than failing CI runs that don't have one.
const checksEnabled = Boolean(process.env.DATABASE_URL);

type TestDb = { prisma: PrismaClient; pool: Pool };
type TestUser = { id: string; email: string; plan: string; sessionVersion: number };
type JsonObject = Record<string, unknown>;

let db: TestDb;

const sessionSecret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-development-session-secret";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function generateUserToken(userId: string, email: string, plan: string, sessionVersion = 0) {
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ userId, email, plan, sessionVersion, expiry });
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64");
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

async function json(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<JsonObject> {
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object response.");
  return value as JsonObject;
}

const PASSWORD = "two-factor-e2e-password";

async function createTestUser(label: string): Promise<TestUser> {
  const email = `two-factor-${label}-${randomUUID()}@rive.test`;
  return db.prisma.user.create({
    data: {
      email,
      name: `Two Factor ${label}`,
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

// Enrolment consumes the current 30s step, and the replay guard then rejects
// any code from that step; the next step is still inside the accepted window.
// (Codes below that use `Date.now() + 30_000` rely on this.)
async function deleteTestUser(userId: string) {
  await db.prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
}

async function authenticateBrowser(context: BrowserContext, baseURL: string, token: string) {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: "rive_session",
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
}

test.describe("two-factor authentication", () => {
  test.skip(!checksEnabled, "Requires DATABASE_URL with a migrated test database.");
  test.setTimeout(90_000);

  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for two-factor tests.");
    const parsedConnectionString = new URL(process.env.DATABASE_URL);
    for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsedConnectionString.searchParams.delete(parameter);
    const pool = new Pool({ connectionString: parsedConnectionString.toString(), ssl: sslConfig() });
    db = { pool, prisma: new PrismaClient({ adapter: new PrismaPg(pool) }) };
    await db.prisma.$queryRaw`SELECT 1`;
  });

  test.afterAll(async () => {
    await db?.prisma.$disconnect();
    await db?.pool.end();
  });

  test("enroll, sign out, sign back in with a TOTP code, then with a recovery code", async ({ context, baseURL }) => {
    const request = context.request;
    const user = await createTestUser("enroll-flow");
    try {
      await authenticateBrowser(context, baseURL!, generateUserToken(user.id, user.email, user.plan, user.sessionVersion));

      // 1. Enroll: start, confirm with a real code from the issued secret.
      const startResponse = await request.post("/api/workflow/two-factor/enroll/start");
      expect(startResponse.status()).toBe(200);
      const started = await json(startResponse);
      const manualKey = String(started.manualKey).replace(/\s+/g, "");
      expect(manualKey.length).toBeGreaterThan(0);

      const confirmResponse = await request.post("/api/workflow/two-factor/enroll/confirm", {
        data: { code: totpCode(manualKey, Date.now()) },
      });
      expect(confirmResponse.status()).toBe(200);
      const confirmed = await json(confirmResponse);
      const recoveryCodes = confirmed.recoveryCodes as string[];
      expect(recoveryCodes).toHaveLength(10);

      const enabledUser = await db.prisma.user.findUnique({ where: { id: user.id }, select: { twoFactorEnabledAt: true, sessionVersion: true } });
      expect(enabledUser?.twoFactorEnabledAt).not.toBeNull();
      expect(enabledUser?.sessionVersion).toBe(user.sessionVersion + 1);

      // 2. Sign out (drop the browser's session) and sign in with password + TOTP.
      await context.clearCookies();
      const loginResponse = await request.post("/api/auth/login", { data: { email: user.email, password: PASSWORD } });
      expect(loginResponse.status()).toBe(200);
      const loginBody = await json(loginResponse);
      expect(loginBody.twoFactorRequired).toBe(true);

      const sessionAfterPassword = await request.get("/api/auth/session");
      expect(sessionAfterPassword.status()).toBe(401); // no session yet, only the pending challenge

      const verifyResponse = await request.post("/api/auth/two-factor/verify", {
        data: { code: totpCode(manualKey, Date.now() + 30_000) },
      });
      expect(verifyResponse.status()).toBe(200);
      expect((await json(verifyResponse)).success).toBe(true);

      const sessionAfterTotp = await request.get("/api/auth/session");
      expect(sessionAfterTotp.status()).toBe(200);

      // 3. Sign out again and sign in with a recovery code instead.
      await context.clearCookies();
      const secondLogin = await request.post("/api/auth/login", { data: { email: user.email, password: PASSWORD } });
      expect((await json(secondLogin)).twoFactorRequired).toBe(true);

      const recoveryCode = recoveryCodes[0];
      const recoveryVerify = await request.post("/api/auth/two-factor/verify", { data: { code: recoveryCode } });
      expect(recoveryVerify.status()).toBe(200);

      const sessionAfterRecovery = await request.get("/api/auth/session");
      expect(sessionAfterRecovery.status()).toBe(200);

      // The recovery code is single-use: reusing it must fail even with a
      // fresh challenge.
      await context.clearCookies();
      await request.post("/api/auth/login", { data: { email: user.email, password: PASSWORD } });
      const reuseAttempt = await request.post("/api/auth/two-factor/verify", { data: { code: recoveryCode } });
      expect(reuseAttempt.status()).toBe(401);

      const usedCode = await db.prisma.twoFactorRecoveryCode.findFirst({ where: { userId: user.id, usedAt: { not: null } } });
      expect(usedCode).not.toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a wrong TOTP code is rejected and the same code cannot be replayed", async ({ context, baseURL }) => {
    const request = context.request;
    const user = await createTestUser("replay");
    try {
      await authenticateBrowser(context, baseURL!, generateUserToken(user.id, user.email, user.plan, user.sessionVersion));
      const started = await json(await request.post("/api/workflow/two-factor/enroll/start"));
      const manualKey = String(started.manualKey).replace(/\s+/g, "");
      await request.post("/api/workflow/two-factor/enroll/confirm", { data: { code: totpCode(manualKey, Date.now()) } });

      await context.clearCookies();
      await request.post("/api/auth/login", { data: { email: user.email, password: PASSWORD } });

      const wrongAttempt = await request.post("/api/auth/two-factor/verify", { data: { code: "000000" } });
      expect(wrongAttempt.status()).toBe(401);

      const code = totpCode(manualKey, Date.now() + 30_000);
      const firstUse = await request.post("/api/auth/two-factor/verify", { data: { code } });
      expect(firstUse.status()).toBe(200);

      // Same code, a fresh challenge: must not be replayable even though the
      // six digits are still numerically valid for this 30s window.
      await context.clearCookies();
      await request.post("/api/auth/login", { data: { email: user.email, password: PASSWORD } });
      const replay = await request.post("/api/auth/two-factor/verify", { data: { code } });
      expect(replay.status()).toBe(401);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("disabling requires the current password and a current code, and turns 2FA fully off", async ({ context, baseURL }) => {
    const request = context.request;
    const user = await createTestUser("disable");
    try {
      await authenticateBrowser(context, baseURL!, generateUserToken(user.id, user.email, user.plan, user.sessionVersion));
      const started = await json(await request.post("/api/workflow/two-factor/enroll/start"));
      const manualKey = String(started.manualKey).replace(/\s+/g, "");
      await request.post("/api/workflow/two-factor/enroll/confirm", { data: { code: totpCode(manualKey, Date.now()) } });

      const missingPassword = await request.post("/api/workflow/two-factor/disable", {
        data: { code: totpCode(manualKey, Date.now() + 30_000) },
      });
      expect(missingPassword.status()).toBe(401);

      const wrongPassword = await request.post("/api/workflow/two-factor/disable", {
        data: { password: "not-the-password", code: totpCode(manualKey, Date.now() + 30_000) },
      });
      expect(wrongPassword.status()).toBe(401);

      const disableResponse = await request.post("/api/workflow/two-factor/disable", {
        data: { password: PASSWORD, code: totpCode(manualKey, Date.now() + 30_000) },
      });
      expect(disableResponse.status()).toBe(200);

      const disabledUser = await db.prisma.user.findUnique({
        where: { id: user.id },
        select: { twoFactorEnabledAt: true, twoFactorSecretEncrypted: true },
      });
      expect(disabledUser?.twoFactorEnabledAt).toBeNull();
      expect(disabledUser?.twoFactorSecretEncrypted).toBeNull();
      expect(await db.prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(0);

      // Signing in no longer requires a second factor.
      await context.clearCookies();
      const loginAfterDisable = await request.post("/api/auth/login", { data: { email: user.email, password: PASSWORD } });
      expect(loginAfterDisable.status()).toBe(200);
      expect((await json(loginAfterDisable)).twoFactorRequired).toBeFalsy();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("cross-tenant isolation: another user's recovery code and challenge cannot be used", async ({ context, baseURL }) => {
    const request = context.request;
    const owner = await createTestUser("cross-owner");
    const other = await createTestUser("cross-other");
    try {
      await authenticateBrowser(context, baseURL!, generateUserToken(owner.id, owner.email, owner.plan, owner.sessionVersion));
      const started = await json(await request.post("/api/workflow/two-factor/enroll/start"));
      const manualKey = String(started.manualKey).replace(/\s+/g, "");
      const confirmed = await json(await request.post("/api/workflow/two-factor/enroll/confirm", { data: { code: totpCode(manualKey, Date.now()) } }));
      const ownerRecoveryCode = (confirmed.recoveryCodes as string[])[0];

      // The other user (no 2FA enrolled) signs in with a plain password and
      // gets a normal session, no challenge involved.
      await context.clearCookies();
      const otherLogin = await request.post("/api/auth/login", { data: { email: other.email, password: PASSWORD } });
      expect((await json(otherLogin)).twoFactorRequired).toBeFalsy();

      // Owner's recovery code must not work as a general credential once
      // there's no matching pending challenge for the other account.
      const crossAttempt = await request.post("/api/auth/two-factor/verify", { data: { code: ownerRecoveryCode } });
      expect(crossAttempt.status()).toBe(400);
      expect((await json(crossAttempt)).code).toBe("CHALLENGE_EXPIRED");
    } finally {
      await deleteTestUser(owner.id);
      await deleteTestUser(other.id);
    }
  });

  test("an email verification link does not sign in an account that has 2FA on", async ({ context, baseURL }) => {
    const request = context.request;
    const user = await createTestUser("verify-email");
    try {
      await authenticateBrowser(context, baseURL!, generateUserToken(user.id, user.email, user.plan, user.sessionVersion));
      const started = await json(await request.post("/api/workflow/two-factor/enroll/start"));
      const manualKey = String(started.manualKey).replace(/\s+/g, "");
      expect((await request.post("/api/workflow/two-factor/enroll/confirm", { data: { code: totpCode(manualKey, Date.now()) } })).status()).toBe(200);

      const token = randomBytes(32).toString("base64url");
      await db.prisma.authToken.create({
        data: {
          email: user.email,
          userId: user.id,
          type: "email_verification",
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await context.clearCookies();
      const verified = await request.post("/api/auth/verify-email", { data: { token } });
      expect(verified.status()).toBe(200);
      expect((await json(verified)).destination).toBe("/login");
      expect((await request.get("/api/auth/session")).status()).toBe(401);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("turning 2FA on from Settings, then signing in through the browser with a code", async ({ context, page, baseURL }) => {
    const user = await createTestUser("browser");
    try {
      await authenticateBrowser(context, baseURL!, generateUserToken(user.id, user.email, user.plan, user.sessionVersion));
      await page.goto("/settings#security");
      await page.getByTestId("two-factor-enable-button").click({ timeout: 30_000 });
      const manualKey = (await page.getByTestId("two-factor-manual-key").inputValue()).replace(/\s+/g, "");
      await page.getByTestId("two-factor-confirm-input").fill(totpCode(manualKey, Date.now()) || "");
      await page.getByTestId("two-factor-confirm-button").click();
      await expect(page.getByTestId("two-factor-recovery-codes").locator("li")).toHaveCount(10);
      await page.getByTestId("two-factor-recovery-confirm-checkbox").check();
      await page.getByTestId("two-factor-recovery-confirm-button").click();
      await expect(page.getByText(/On since/)).toBeVisible();

      await context.clearCookies();
      await page.goto("/login");
      await expect(page.locator('form[data-testid="login-form"][data-hydrated="true"]')).toBeVisible({ timeout: 30_000 });
      await page.locator("#login-email").fill(user.email);
      await page.locator("#login-password").fill(PASSWORD);
      await page.getByTestId("login-submit").click();
      await expect(page).toHaveURL(/\/login\/two-factor/, { timeout: 30_000 });
      await expect(page.locator('form[data-testid="two-factor-form"][data-hydrated="true"]')).toBeVisible({ timeout: 30_000 });
      await page.locator("#two-factor-code").fill(totpCode(manualKey, Date.now() + 30_000) || "");
      await page.getByTestId("two-factor-submit").click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
