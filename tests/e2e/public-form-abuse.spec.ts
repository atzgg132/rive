import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Pool } from "pg";

/**
 * Bot gate, rate limits, and verified-only password-reset mail on the three
 * public forms crawlers have been hitting: contact, register, forgot-password.
 *
 * Each test uses its own X-Forwarded-For address so a durable IP window in one
 * case cannot spend another's allowance. The 13.x space is used here; the
 * enquiry suite uses 11.x.
 */

loadEnvConfig(process.cwd());

const dbChecksEnabled = Boolean(process.env.DATABASE_URL);

type TestDb = { prisma: PrismaClient; pool: Pool };
let db: TestDb;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
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

let ipCounter = 0;
function uniqueIp() {
  ipCounter += 1;
  const worker = Number(process.env.TEST_WORKER_INDEX || 0) % 200;
  return `13.${worker}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

function headers(ip: string) {
  return { "Content-Type": "application/json", "X-Forwarded-For": ip };
}

function humanStartedAt() {
  return Date.now() - 8_000;
}

function contactPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ada Lovelace",
    email: `contact-${randomUUID()}@example.invalid`,
    subject: "General Inquiry",
    message: "I would like to ask about using rive. for my studio.",
    startedAt: humanStartedAt(),
    ...overrides,
  };
}

function registerPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ada Lovelace",
    email: `register-${randomUUID()}@rive.test`,
    password: "form-abuse-password",
    startedAt: humanStartedAt(),
    ...overrides,
  };
}

async function postJson(request: APIRequestContext, path: string, data: Record<string, unknown>, ip = uniqueIp()) {
  return request.post(path, { headers: headers(ip), data });
}

test.describe("public form abuse controls", () => {
  test.skip(!dbChecksEnabled, "Requires DATABASE_URL with a migrated test database.");
  test.setTimeout(60_000);

  test.beforeAll(async () => {
    const parsed = new URL(process.env.DATABASE_URL as string);
    for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsed.searchParams.delete(parameter);
    const pool = new Pool({ connectionString: parsed.toString(), ssl: sslConfig() });
    db = { pool, prisma: new PrismaClient({ adapter: new PrismaPg(pool) }) };
    await db.prisma.$queryRaw`SELECT 1`;
  });

  test.afterAll(async () => {
    await db?.prisma.$disconnect();
    await db?.pool.end();
  });

  test("contact honeypot is present on the page and not visible", async ({ page }: { page: Page }) => {
    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).toBeHidden();
  });

  test("register form posts startedAt and an empty honeypot", async ({ page }: { page: Page }) => {
    let posted: Record<string, unknown> | null = null;
    await page.route("**/api/auth/register", async (route) => {
      posted = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, requiresEmailVerification: true }),
      });
    });

    await page.goto("/register", { waitUntil: "domcontentloaded" });
    await page.locator("#register-name").fill("Ada Lovelace");
    await page.locator("#register-email").fill("ada@example.invalid");
    await page.locator("#register-password").fill("a-real-password");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect.poll(() => posted).not.toBeNull();
    expect(typeof posted!.startedAt).toBe("number");
    expect(posted!.website === "" || posted!.website == null).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  });

  test("a genuine contact message is accepted by the bot gate", async ({ request }) => {
    const response = await postJson(request, "/api/contact", contactPayload());
    // CI has EMAIL_PROVIDER=ses and no credentials, so delivery returns 503
    // after the gate. Local console delivery returns 200. Either means this
    // was not dropped as a bot.
    expect([200, 503], await response.text()).toContain(response.status());
    const data = await response.json();
    if (response.status() === 200) expect(data.success).toBe(true);
    else expect(data.success).toBe(false);
  });

  test("a contact honeypot submission is thanked and does not attempt delivery", async ({ request }) => {
    const response = await postJson(request, "/api/contact", contactPayload({ website: "http://spam.example" }));
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  test("a too-fast contact submission is thanked and does not attempt delivery", async ({ request }) => {
    const response = await postJson(request, "/api/contact", contactPayload({ startedAt: Date.now() }));
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });

  test("contact is rate-limited per IP", async ({ request }) => {
    const ip = uniqueIp();
    let lastStatus = 0;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await postJson(request, "/api/contact", contactPayload(), ip);
      lastStatus = response.status();
      if (attempt < 5) expect([200, 503], `attempt ${attempt + 1}`).toContain(lastStatus);
    }
    expect(lastStatus).toBe(429);
  });

  test("signup still creates an account for a real person", async ({ request }) => {
    const payload = registerPayload();
    const response = await postJson(request, "/api/auth/register", payload);
    expect(response.status(), await response.text()).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.requiresEmailVerification).toBe(true);

    const user = await db.prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
    expect(user).not.toBeNull();
    await db.prisma.user.delete({ where: { id: user!.id } }).catch(() => undefined);
  });

  test("a register honeypot submission is thanked and stores no account", async ({ request }) => {
    const payload = registerPayload({ website: "http://spam.example" });
    const response = await postJson(request, "/api/auth/register", payload);
    expect(response.status()).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ success: true, requiresEmailVerification: true });
    expect(await db.prisma.user.count({ where: { email: payload.email } })).toBe(0);
  });

  test("a too-fast register submission is thanked and stores no account", async ({ request }) => {
    const payload = registerPayload({ startedAt: Date.now() });
    const response = await postJson(request, "/api/auth/register", payload);
    expect(response.status()).toBe(201);
    expect(await db.prisma.user.count({ where: { email: payload.email } })).toBe(0);
  });

  test("register is rate-limited per email", async ({ request }) => {
    const ip = uniqueIp();
    const email = `register-limit-${randomUUID()}@rive.test`;
    const createdIds: string[] = [];
    try {
      let lastStatus = 0;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await postJson(request, "/api/auth/register", registerPayload({ email }), ip);
        lastStatus = response.status();
        if (attempt === 0) {
          expect(lastStatus).toBe(201);
          const user = await db.prisma.user.findUnique({ where: { email }, select: { id: true } });
          if (user) createdIds.push(user.id);
        } else if (attempt < 4) {
          expect(lastStatus).toBe(409);
        }
      }
      expect(lastStatus).toBe(429);
    } finally {
      for (const id of createdIds) await db.prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
  });

  test("forgot-password sends a reset token for a verified account", async ({ request }) => {
    const email = `verified-reset-${randomUUID()}@rive.test`;
    const user = await db.prisma.user.create({
      data: {
        email,
        name: "Verified Reset",
        passwordHash: hashPassword("verified-reset-password"),
        plan: "free",
        emailVerifiedAt: new Date(),
        emailVerificationRequiredAt: new Date(),
        currency: "USD",
        timeZone: "UTC",
      },
      select: { id: true },
    });
    try {
      const response = await postJson(request, "/api/auth/forgot-password", { email, startedAt: humanStartedAt() });
      expect(response.status()).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ success: true });
      expect(await db.prisma.authToken.count({ where: { userId: user.id, type: "password_reset" } })).toBe(1);
    } finally {
      await db.prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("forgot-password does not mail an unverified account", async ({ request }) => {
    const email = `unverified-reset-${randomUUID()}@rive.test`;
    const user = await db.prisma.user.create({
      data: {
        email,
        name: "Unverified Reset",
        passwordHash: hashPassword("unverified-reset-password"),
        plan: "free",
        emailVerifiedAt: null,
        emailVerificationRequiredAt: new Date(),
        currency: "USD",
        timeZone: "UTC",
      },
      select: { id: true },
    });
    try {
      const response = await postJson(request, "/api/auth/forgot-password", { email, startedAt: humanStartedAt() });
      expect(response.status()).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ success: true });
      expect(await db.prisma.authToken.count({ where: { userId: user.id, type: "password_reset" } })).toBe(0);
    } finally {
      await db.prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("forgot-password still works for a grandfathered account that never had verification required", async ({ request }) => {
    const email = `legacy-reset-${randomUUID()}@rive.test`;
    const user = await db.prisma.user.create({
      data: {
        email,
        name: "Legacy Reset",
        passwordHash: hashPassword("legacy-reset-password"),
        plan: "free",
        currency: "USD",
        timeZone: "UTC",
      },
      select: { id: true },
    });
    try {
      const response = await postJson(request, "/api/auth/forgot-password", { email, startedAt: humanStartedAt() });
      expect(response.status()).toBe(200);
      expect(await db.prisma.authToken.count({ where: { userId: user.id, type: "password_reset" } })).toBe(1);
    } finally {
      await db.prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("a forgot-password honeypot submission creates no reset token", async ({ request }) => {
    const email = `honeypot-reset-${randomUUID()}@rive.test`;
    const user = await db.prisma.user.create({
      data: {
        email,
        name: "Honeypot Reset",
        passwordHash: hashPassword("honeypot-reset-password"),
        plan: "free",
        emailVerifiedAt: new Date(),
        emailVerificationRequiredAt: new Date(),
        currency: "USD",
        timeZone: "UTC",
      },
      select: { id: true },
    });
    try {
      const response = await postJson(request, "/api/auth/forgot-password", {
        email,
        website: "http://spam.example",
        startedAt: humanStartedAt(),
      });
      expect(response.status()).toBe(200);
      expect(await db.prisma.authToken.count({ where: { userId: user.id, type: "password_reset" } })).toBe(0);
    } finally {
      await db.prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("a too-fast forgot-password submission creates no reset token", async ({ request }) => {
    const email = `fast-reset-${randomUUID()}@rive.test`;
    const user = await db.prisma.user.create({
      data: {
        email,
        name: "Fast Reset",
        passwordHash: hashPassword("fast-reset-password"),
        plan: "free",
        emailVerifiedAt: new Date(),
        emailVerificationRequiredAt: new Date(),
        currency: "USD",
        timeZone: "UTC",
      },
      select: { id: true },
    });
    try {
      const response = await postJson(request, "/api/auth/forgot-password", { email, startedAt: Date.now() });
      expect(response.status()).toBe(200);
      expect(await db.prisma.authToken.count({ where: { userId: user.id, type: "password_reset" } })).toBe(0);
    } finally {
      await db.prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("forgot-password is rate-limited per email", async ({ request }) => {
    const email = `limit-reset-${randomUUID()}@rive.test`;
    const ip = uniqueIp();
    const user = await db.prisma.user.create({
      data: {
        email,
        name: "Limit Reset",
        passwordHash: hashPassword("limit-reset-password"),
        plan: "free",
        emailVerifiedAt: new Date(),
        emailVerificationRequiredAt: new Date(),
        currency: "USD",
        timeZone: "UTC",
      },
      select: { id: true },
    });
    try {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await postJson(request, "/api/auth/forgot-password", { email, startedAt: humanStartedAt() }, ip);
        expect(response.status()).toBe(200);
      }
      expect(await db.prisma.authToken.count({ where: { userId: user.id, type: "password_reset" } })).toBe(3);
    } finally {
      await db.prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });
});
