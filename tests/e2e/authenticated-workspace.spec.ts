import { createHmac } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { checkServerIdentity } from "node:tls";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";

const dashboardRoutes = [
  { route: "/dashboard", endpoint: "/api/workflow/dashboard" },
  { route: "/calendar", endpoint: "/api/calendar/events" },
  { route: "/workflow/projects", endpoint: "/api/workflow/projects" },
  { route: "/workflow/contracts", endpoint: "/api/workflow/contracts" },
  { route: "/workflow/clients", endpoint: "/api/workflow/clients" },
  { route: "/workflow/revenue", endpoint: "/api/workflow/invoices" },
  { route: "/workflow/expenses", endpoint: "/api/workflow/expenses" },
  { route: "/portfolio", endpoint: "/api/portfolio" },
];

let sessionTokenPromise: Promise<string> | undefined;

async function getSessionToken() {
  if (!sessionTokenPromise) {
    sessionTokenPromise = (async () => {
      loadEnvConfig(process.cwd());
      const email = process.env.E2E_USER_EMAIL?.trim().toLowerCase();
      if (!email) throw new Error("E2E_USER_EMAIL is required for authenticated workspace tests.");

      const ssl =
        process.env.DATABASE_SSL === "disable" ||
        process.env.DATABASE_URL?.includes("sslmode=disable")
          ? false
          : {
              rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
              ...(process.env.DATABASE_SSL_SERVERNAME ? { checkServerIdentity: (_hostname: string, certificate: Parameters<typeof checkServerIdentity>[1]) => checkServerIdentity(process.env.DATABASE_SSL_SERVERNAME!, certificate) } : {}),
            };
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new Error("DATABASE_URL is required for authenticated workspace tests");
      const parsedConnectionString = new URL(databaseUrl);
      for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsedConnectionString.searchParams.delete(parameter);
      const pool = new Pool({ connectionString: parsedConnectionString.toString(), ssl });
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

      try {
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, plan: true, sessionVersion: true },
        });
        if (!user) throw new Error(`No test user exists for ${email}.`);
        const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
        const payload = JSON.stringify({ userId: user.id, email: user.email, plan: user.plan, sessionVersion: user.sessionVersion, expiry });
        const secret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-development-session-secret";
        const signature = createHmac("sha256", secret).update(payload).digest("hex");
        return Buffer.from(`${payload}.${signature}`).toString("base64");
      } finally {
        await prisma.$disconnect();
        await pool.end();
      }
    })();
  }

  return sessionTokenPromise;
}

async function authenticate(context: BrowserContext, baseURL: string) {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: "rive_session",
      value: await getSessionToken(),
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
}

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  return errors;
}

test.describe("authenticated workspace", () => {
  test.setTimeout(60_000);
  test.skip(!process.env.E2E_USER_EMAIL, "Set E2E_USER_EMAIL to run authenticated workspace checks.");

  for (const { route, endpoint } of dashboardRoutes) {
    test(`${route} renders seeded workspace data without runtime errors`, async ({ context, page, baseURL }) => {
      await authenticate(context, baseURL!);
      const errors = captureRuntimeErrors(page);
      const dataResponsePromise = page.waitForResponse(
        (response) => response.url().includes(endpoint) && response.request().method() === "GET",
      );
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      const dataResponse = await dataResponsePromise;

      expect(response?.status()).toBeLessThan(500);
      expect(dataResponse.status(), `${endpoint} returned ${dataResponse.status()}`).toBeLessThan(500);
      await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}(?:\\?.*)?$`));
      await expect(page.locator("main.flex-1")).toBeVisible({ timeout: 15_000 });

      const dimensions = await page.evaluate(() => {
        const clientWidth = document.documentElement.clientWidth;
        const overflowSources = Array.from(document.querySelectorAll("body *"))
          .map((element) => {
            const bounds = element.getBoundingClientRect();
            return {
              className: element.getAttribute("class") || "",
              right: Math.round(bounds.right),
              tag: element.tagName.toLowerCase(),
              width: Math.round(bounds.width),
            };
          })
          .filter((element) => element.right > clientWidth + 1)
          .slice(0, 8);

        return {
          clientWidth,
          overflowSources,
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
      expect(
        dimensions.scrollWidth,
        `Overflow sources: ${JSON.stringify(dimensions.overflowSources)}`,
      ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      expect(errors, `${route} emitted browser errors`).toEqual([]);
    });
  }

  test("migrated choice and compact calendar controls retain the correct dimensions", async ({
    context,
    page,
    baseURL,
  }) => {
    await authenticate(context, baseURL!);
    const portfolioResponse = page.waitForResponse(
      (response) => response.url().includes("/api/portfolio") && response.request().method() === "GET",
    );
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await portfolioResponse;

    const choiceSizes = await page.locator('input[type="checkbox"], input[type="radio"]').evaluateAll(
      (controls) =>
        controls.map((control) => {
          const bounds = control.getBoundingClientRect();
          return { height: bounds.height, width: bounds.width };
        }),
    );
    expect(choiceSizes.length).toBeGreaterThan(0);
    for (const size of choiceSizes) {
      expect(size.width).toBeLessThanOrEqual(24);
      expect(size.height).toBeLessThanOrEqual(24);
    }

    const calendarResponse = page.waitForResponse(
      (response) => response.url().includes("/api/calendar/events") && response.request().method() === "GET",
    );
    await page.goto("/calendar", { waitUntil: "domcontentloaded" });
    await calendarResponse;
    const monthSize = await page.locator('select[aria-label="Select month"]').evaluate((control) => {
      const bounds = control.getBoundingClientRect();
      return { height: bounds.height, width: bounds.width };
    });
    const yearSize = await page.locator('input[aria-label="Select year"]').evaluate((control) => {
      const bounds = control.getBoundingClientRect();
      return { height: bounds.height, width: bounds.width };
    });

    expect(monthSize.height).toBeLessThan(32);
    expect(monthSize.width).toBeLessThan(120);
    expect(yearSize.height).toBeLessThan(32);
    expect(yearSize.width).toBeLessThan(64);
  });
});
