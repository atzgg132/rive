import { checkServerIdentity } from "node:tls";
import { PrismaPg } from "@prisma/adapter-pg";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

// These checks drive the real login route, the real session cookie and the real
// admin APIs. The pre-existing admin specs stub every endpoint, which is why a
// cookie the browser refused to send to /api/admin/* still looked healthy in CI.
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

const ADMIN_SESSION_COOKIE = "rive_admin_session";
const adminTabs = ["Overview", "Funnel", "Users", "Feedback", "Reliability", "Legacy archive"];
const protectedEndpoints = [
  "/api/admin/analytics",
  "/api/admin/users?page=1&search=",
  "/api/admin/feedback?status=all",
  "/api/admin/waitlist?page=1&limit=50",
];

test.describe("admin session lifecycle", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!process.env.DATABASE_URL, "A test database is required for the admin session checks.");
  test.skip(
    !adminUsername || !adminPassword,
    "ADMIN_USERNAME and E2E_ADMIN_PASSWORD are required for the admin session checks.",
  );

  let prisma: PrismaClient;
  let pool: Pool;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
    const parsedConnectionString = new URL(process.env.DATABASE_URL!);
    for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsedConnectionString.searchParams.delete(parameter);
    pool = new Pool({
      connectionString: parsedConnectionString.toString(),
      ssl: process.env.DATABASE_SSL === "disable" || process.env.DATABASE_URL?.includes("sslmode=disable")
        ? false
        : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true", ...(sslServerName ? { checkServerIdentity: (_hostname: string, certificate: Parameters<typeof checkServerIdentity>[1]) => checkServerIdentity(sslServerName, certificate) } : {}) },
    });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    // The admin login limiter is durable and shared, so an earlier run would spend
    // this run's five-attempt budget. Only the limiter's own counters are cleared;
    // the limit itself stays exactly as production enforces it.
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: "admin-login:" } } });

    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
    await prisma?.$disconnect();
    await pool?.end();
  });

  test("keeps the admin panel closed before sign-in", async () => {
    expect((await page.request.get("/api/admin/session")).status()).toBe(401);
    expect((await page.request.get("/api/admin/analytics")).status()).toBe(401);

    await page.goto("/admin");
    await expect(page.getByRole("button", { name: "Sign in securely" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  });

  test("rejects invalid credentials once, without a redirect loop", async () => {
    await page.goto("/admin");
    await page.getByLabel("Username").fill(adminUsername!);
    await page.getByLabel("Password", { exact: true }).fill("not-the-admin-password");
    await page.getByRole("button", { name: "Sign in securely" }).click();

    await expect(page.getByRole("alert")).toContainText("Invalid credentials.");
    await expect(page.getByRole("button", { name: "Sign in securely" })).toBeEnabled();

    const stored = (await context.cookies()).find((cookie) => cookie.name === ADMIN_SESSION_COOKIE);
    expect(stored?.value || "").toBe("");
  });

  test("signs in and stores a durable, correctly scoped session cookie", async () => {
    await page.goto("/admin");
    const loginResponse = page.waitForResponse(
      (response) => response.url().includes("/api/admin/login") && response.request().method() === "POST",
    );

    await page.getByLabel("Username").fill(adminUsername!);
    await page.getByLabel("Password", { exact: true }).fill(adminPassword!);
    await page.getByRole("button", { name: "Sign in securely" }).click();

    const response = await loginResponse;
    expect(response.status()).toBe(200);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    const setCookies = (await response.headersArray())
      .filter((header) => header.name.toLowerCase() === "set-cookie" && header.value.startsWith(`${ADMIN_SESSION_COOKIE}=`))
      .map((header) => header.value);
    expect(setCookies.some((value) => /Path=\/(;|$)/.test(value)), `expected a Path=/ session cookie, got ${setCookies.join(" | ")}`).toBe(true);
    // The pre-fix cookie is retired in the same response so it cannot linger for a
    // full TTL and shadow the real one on /admin requests.
    expect(setCookies.some((value) => /Path=\/admin/.test(value) && /Max-Age=0|Expires=Thu, 01 Jan 1970/.test(value))).toBe(true);

    const stored = (await context.cookies()).filter((entry) => entry.name === ADMIN_SESSION_COOKIE);
    expect(stored, "only the correctly scoped session cookie should survive").toHaveLength(1);
    const cookie = stored[0];
    expect(cookie.value).not.toBe("");
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    // The regression itself: "/admin" does not path-match "/api/admin/...", so a
    // session scoped there is stored and then withheld from every check that reads it.
    expect(cookie.path).toBe("/");
  });

  test("authorises the session check and every protected admin API", async () => {
    expect((await page.request.get("/api/admin/session")).status()).toBe(200);

    for (const endpoint of protectedEndpoints) {
      const response = await page.request.get(endpoint);
      expect(response.status(), `${endpoint} must accept the admin session cookie`).not.toBe(401);
    }
  });

  test("stays signed in across a reload", async () => {
    await page.reload();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in securely" })).toHaveCount(0);
  });

  test("stays signed in in a second same-origin tab", async () => {
    const secondTab = await context.newPage();
    try {
      await secondTab.goto("/admin");
      await expect(secondTab.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(secondTab.getByRole("button", { name: "Sign in securely" })).toHaveCount(0);
    } finally {
      await secondTab.close();
    }
  });

  test("loads every admin tab without dropping the session", async () => {
    await page.goto("/admin");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    for (const label of adminTabs) {
      await page.getByRole("button", { name: label, exact: true }).click();
      // A fresh database legitimately has no rows, so assert the workspace stayed
      // authenticated rather than asserting on seeded numbers.
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign in securely" })).toHaveCount(0);
    }
  });

  test("signs out once, with a reason, and invalidates the session", async () => {
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page.getByRole("button", { name: "Sign in securely" })).toBeVisible();
    await expect(page.getByTestId("admin-session-notice")).toContainText("signed out");

    expect((await page.request.get("/api/admin/session")).status()).toBe(401);
    expect((await page.request.get("/api/admin/analytics")).status()).toBe(401);
  });
});
