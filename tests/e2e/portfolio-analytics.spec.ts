import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

/**
 * View attribution and the analytics API, end to end against a real database.
 *
 * Views are written from `after()`, so every assertion polls rather than
 * reading straight after the response — the point of that change was that a
 * visitor should never wait on analytics.
 */

loadEnvConfig(process.cwd());

const dbChecksEnabled = Boolean(process.env.DATABASE_URL);
const sessionSecret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-development-session-secret";

/** A believable desktop browser: Playwright's own headless UA is filtered as a bot. */
const HUMAN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

type TestDb = { prisma: PrismaClient; pool: Pool };
type TestUser = { id: string; email: string; plan: string; sessionVersion: number };

let db: TestDb;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function tokenFor(user: TestUser) {
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ userId: user.id, email: user.email, plan: user.plan, sessionVersion: user.sessionVersion, expiry });
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

function analyticsContent(contactEmail: string) {
  return {
    name: "Analytics Fixture",
    profileImageUrl: "",
    headline: "Independent product designer",
    bio: "Fixture portfolio for analytics tests.",
    location: "Remote",
    availability: "Open",
    contactEmail,
    social: [],
    practices: [],
    practiceLayout: "unified" as const,
    mediaSettings: { autoplayOnScroll: false, loop: false, hoverPreview: false, lightbox: true, layout: "grid" as const, fit: "cover" as const, showCaptions: true },
    projects: [
      { id: "case-alpha", title: "Alpha rebuild", description: "A public project.", role: "Design", year: "2026", url: "", imageUrl: "", visibility: "public" as const, media: [] },
      { id: "case-beta", title: "Beta launch", description: "Another public project.", role: "Design", year: "2026", url: "", imageUrl: "", visibility: "public" as const, media: [] },
    ],
    services: [],
    testimonials: [],
    sections: [
      { key: "about" as const, visible: true }, { key: "projects" as const, visible: true },
      { key: "services" as const, visible: true }, { key: "testimonials" as const, visible: false },
      { key: "contact" as const, visible: true },
    ],
  };
}

async function publishedPortfolio(label: string) {
  const user = await db.prisma.user.create({
    data: {
      email: `analytics-${label}-${randomUUID()}@rive.test`,
      name: `Analytics ${label}`,
      passwordHash: hashPassword("analytics-test-password"),
      plan: "pro",
      onboardingStatus: "complete",
      businessType: "freelancer",
      currency: "USD",
      timeZone: "UTC",
    },
    select: { id: true, email: true, plan: true, sessionVersion: true },
  });
  const slug = `ana-${label}-${randomUUID().slice(0, 8)}`;
  const portfolio = await db.prisma.portfolio.create({
    data: {
      userId: user.id,
      slug,
      status: "published",
      templateKey: "minimal-pro",
      publishedAt: new Date(),
      content: analyticsContent(`owner-${slug}@example.invalid`),
      theme: { accent: "#2563EB", mode: "light", radius: "soft" },
      seo: { title: "Analytics fixture", description: "Fixture", indexable: false },
    },
    select: { id: true, slug: true },
  });
  return { user, portfolio, slug, token: tokenFor(user) };
}

/**
 * Distinct visitors need distinct addresses: the visitor hash is derived from
 * one, so a collision would silently merge two "people" and break a unique
 * count. Counted rather than random, and namespaced per worker, so no two
 * callers anywhere in the suite can land on the same address.
 */
let ipCounter = 0;
function uniqueIp() {
  ipCounter += 1;
  const worker = Number(process.env.TEST_WORKER_INDEX || 0) % 200;
  return `10.${worker}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

/** Matches how the Playwright config resolves its own base URL. */
function baseUrl() {
  return process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${process.env.PLAYWRIGHT_PORT || 3000}`;
}

type VisitOptions = { ip?: string; userAgent?: string; referer?: string; cookie?: string; preview?: boolean };

async function visit(request: APIRequestContext, path: string, options: VisitOptions = {}) {
  return request.get(path, {
    headers: {
      "User-Agent": options.userAgent ?? HUMAN_UA,
      "X-Forwarded-For": options.ip ?? uniqueIp(),
      ...(options.referer ? { Referer: options.referer } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.preview ? { "x-rive-portfolio-preview": "1" } : {}),
    },
  });
}

/** Views land after the response, so settle on a stable count before asserting. */
async function waitForViews(portfolioId: string, expected: number, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let count = await db.prisma.portfolioView.count({ where: { portfolioId } });
  while (count < expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    count = await db.prisma.portfolioView.count({ where: { portfolioId } });
  }
  return count;
}

/** Confirms a count is not merely late by giving any extra writes time to land. */
async function settleViews(portfolioId: string) {
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  return db.prisma.portfolioView.count({ where: { portfolioId } });
}

test.describe("portfolio view attribution and analytics", () => {
  test.skip(!dbChecksEnabled, "Requires DATABASE_URL with a migrated test database.");
  test.setTimeout(120_000);

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

  test("a landing-page read and a case-study read are counted differently", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("attribution");

    expect((await visit(request, `/p/${slug}`, { ip: uniqueIp() })).status()).toBe(200);
    expect((await visit(request, `/p/${slug}/work/case-alpha`, { ip: uniqueIp() })).status()).toBe(200);
    expect(await waitForViews(portfolio.id, 2)).toBe(2);

    const views = await db.prisma.portfolioView.findMany({ where: { portfolioId: portfolio.id } });
    const landing = views.find((view) => view.pageType === "portfolio");
    const caseStudy = views.find((view) => view.pageType === "project");

    expect(landing, "the landing page must record a portfolio view").toBeTruthy();
    expect(landing?.projectId).toBeNull();

    expect(caseStudy, "the case study must record a project view").toBeTruthy();
    expect(caseStudy?.projectId).toBe("case-alpha");
  });

  test("each case study is attributed to its own project", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("per-project");

    await visit(request, `/p/${slug}/work/case-alpha`, { ip: uniqueIp() });
    await visit(request, `/p/${slug}/work/case-alpha`, { ip: uniqueIp() });
    await visit(request, `/p/${slug}/work/case-beta`, { ip: uniqueIp() });
    expect(await waitForViews(portfolio.id, 3)).toBe(3);

    const grouped = await db.prisma.portfolioView.groupBy({
      by: ["projectId"],
      where: { portfolioId: portfolio.id, pageType: "project" },
      _count: { _all: true },
    });
    const byProject = Object.fromEntries(grouped.map((row) => [row.projectId, row._count._all]));
    expect(byProject["case-alpha"]).toBe(2);
    expect(byProject["case-beta"]).toBe(1);
  });

  test("rapid reloads by one visitor do not inflate the count", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("dedup");
    const ip = uniqueIp();

    /* The first view is settled before reloading. De-duplication reads what is
       already recorded, and views are written after the response, so firing all
       four at once would be racing the writer rather than testing the rule. */
    await visit(request, `/p/${slug}`, { ip });
    expect(await waitForViews(portfolio.id, 1)).toBe(1);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await visit(request, `/p/${slug}`, { ip });
    }
    expect(await settleViews(portfolio.id), "a reload is the same visit, not a new one").toBe(1);

    // The same visitor on a different page is a genuinely different read.
    await visit(request, `/p/${slug}/work/case-alpha`, { ip });
    expect(await waitForViews(portfolio.id, 2)).toBe(2);

    // And a different visitor on the original page counts again.
    await visit(request, `/p/${slug}`, { ip: uniqueIp() });
    expect(await waitForViews(portfolio.id, 3)).toBe(3);
  });

  test("the public JSON route does not double-count a page that was just rendered", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("double-count");
    const ip = uniqueIp();

    await visit(request, `/p/${slug}`, { ip });
    expect(await waitForViews(portfolio.id, 1)).toBe(1);

    expect((await visit(request, `/api/public/portfolio/${slug}`, { ip })).status()).toBe(200);
    expect(await settleViews(portfolio.id), "one visit through two doors is still one visit").toBe(1);
  });

  test("crawlers, preview renders, and the owner's own reads are excluded", async ({ request }) => {
    const { portfolio, slug, token } = await publishedPortfolio("exclusions");

    await visit(request, `/p/${slug}`, { userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
    await visit(request, `/p/${slug}`, { userAgent: "facebookexternalhit/1.1" });
    await visit(request, `/p/${slug}`, { userAgent: "curl/8.4.0" });
    await visit(request, `/api/public/portfolio/${slug}?preview=1`);
    await visit(request, `/p/${slug}`, { preview: true });
    await visit(request, `/p/${slug}`, { cookie: `rive_session=${token}` });

    expect(await settleViews(portfolio.id), "none of these are audience interest").toBe(0);

    // A real visitor still counts, so the filter is not simply rejecting everything.
    await visit(request, `/p/${slug}`, { ip: uniqueIp() });
    expect(await waitForViews(portfolio.id, 1)).toBe(1);
  });

  test("device and referrer attribution are recorded correctly", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("attribution-detail");

    await visit(request, `/p/${slug}`, { ip: uniqueIp(), userAgent: IPAD_UA, referer: "https://www.google.com/search?q=designer" });
    expect(await waitForViews(portfolio.id, 1)).toBe(1);

    const [view] = await db.prisma.portfolioView.findMany({ where: { portfolioId: portfolio.id } });
    expect(view.deviceType, "an iPad is a tablet, not a phone").toBe("tablet");
    expect(view.referrer).toBe("https://www.google.com");
    expect(view.visitorHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(view), "no raw address may be stored").not.toContain("198.51.");
  });

  /* ------------------------------------------------------------------ */
  /* Analytics API                                                       */
  /* ------------------------------------------------------------------ */

  test("only supported ranges are accepted", async ({ request }) => {
    const { token } = await publishedPortfolio("ranges");
    const auth = { Cookie: `rive_session=${token}` };

    for (const range of ["7d", "30d", "90d", "all"]) {
      const response = await request.get(`/api/portfolio/analytics?range=${range}`, { headers: auth });
      expect(response.status(), range).toBe(200);
      expect((await response.json()).analytics.range).toBe(range);
    }

    // Absent means the default, not an error.
    expect((await (await request.get("/api/portfolio/analytics", { headers: auth })).json()).analytics.range).toBe("30d");

    for (const range of ["1d", "365d", "week", "-7d", "all-time"]) {
      const response = await request.get(`/api/portfolio/analytics?range=${range}`, { headers: auth });
      expect(response.status(), range).toBe(400);
    }
  });

  test("aggregates split portfolio and project views, and rank projects by attention", async ({ request }) => {
    const { portfolio, slug, token } = await publishedPortfolio("aggregate");

    await visit(request, `/p/${slug}`, { ip: uniqueIp() });
    await visit(request, `/p/${slug}`, { ip: uniqueIp() });
    await visit(request, `/p/${slug}/work/case-alpha`, { ip: uniqueIp() });
    await visit(request, `/p/${slug}/work/case-alpha`, { ip: uniqueIp() });
    await visit(request, `/p/${slug}/work/case-alpha`, { ip: uniqueIp() });
    await visit(request, `/p/${slug}/work/case-beta`, { ip: uniqueIp() });
    expect(await waitForViews(portfolio.id, 6)).toBe(6);

    const response = await request.get("/api/portfolio/analytics?range=30d", { headers: { Cookie: `rive_session=${token}` } });
    expect(response.status()).toBe(200);
    const { analytics } = await response.json();

    expect(analytics.totals.views).toBe(6);
    expect(analytics.totals.portfolioViews).toBe(2);
    expect(analytics.totals.projectViews).toBe(4);
    expect(analytics.totals.estimatedVisitors).toBe(6);
    expect(analytics.window.days).toBe(30);
    expect(analytics.estimateNote).toContain("no raw IP");

    expect(analytics.projects[0].projectId).toBe("case-alpha");
    expect(analytics.projects[0].title).toBe("Alpha rebuild");
    expect(analytics.projects[0].views).toBe(3);
    expect(analytics.projects[0].exists).toBe(true);
    expect(analytics.projects[0].attentionShare).toBe(75);
    expect(analytics.projects[1].projectId).toBe("case-beta");
    expect(analytics.projects[1].attentionShare).toBe(25);

    const timelineTotal = analytics.timeline.reduce((sum: number, day: { views: number }) => sum + day.views, 0);
    expect(timelineTotal).toBe(6);
  });

  test("an enquiry appears in the conversion figures", async ({ request }) => {
    const { portfolio, slug, token } = await publishedPortfolio("conversion");

    for (let index = 0; index < 4; index += 1) await visit(request, `/p/${slug}`, { ip: uniqueIp() });
    expect(await waitForViews(portfolio.id, 4)).toBe(4);

    const submitted = await request.post(`/api/public/portfolio/${slug}/inquiries`, {
      headers: { "Content-Type": "application/json", "X-Forwarded-For": uniqueIp() },
      data: {
        name: "Jane Smith",
        email: `visitor-${randomUUID().slice(0, 8)}@example.invalid`,
        projectType: "Website redesign",
        message: `We would like to discuss a rebuild of our site. ${randomUUID()}`,
        sourceProjectId: "case-alpha",
      },
    });
    expect(submitted.status()).toBe(201);

    const { analytics } = await (await request.get("/api/portfolio/analytics?range=30d", { headers: { Cookie: `rive_session=${token}` } })).json();
    expect(analytics.totals.inquiries).toBe(1);
    expect(analytics.totals.conversionRate).toBe(25);
    expect(analytics.inquiries.total).toBe(1);
    expect(analytics.inquiries.unread).toBe(1);
    expect(analytics.inquiries.latestAt).toBeTruthy();
  });

  test("spam is excluded from conversion but still visible in the breakdown", async ({ request }) => {
    const { slug, token } = await publishedPortfolio("spam-excluded");
    const auth = { Cookie: `rive_session=${token}`, "Content-Type": "application/json" };

    const submitted = await request.post(`/api/public/portfolio/${slug}/inquiries`, {
      headers: { "Content-Type": "application/json", "X-Forwarded-For": uniqueIp() },
      data: {
        name: "Spam Sender",
        email: `spam-${randomUUID().slice(0, 8)}@example.invalid`,
        projectType: "Cheap SEO",
        message: `We can get you to the top of Google today. ${randomUUID()}`,
      },
    });
    expect(submitted.status()).toBe(201);

    const list = await (await request.get("/api/portfolio/inquiries", { headers: auth })).json();
    await request.patch(`/api/portfolio/inquiries/${list.inquiries[0].id}`, { headers: auth, data: { action: "spam" } });

    const { analytics } = await (await request.get("/api/portfolio/analytics?range=30d", { headers: auth })).json();
    expect(analytics.totals.inquiries).toBe(0);
    expect(analytics.inquiries.total).toBe(0);
    expect(analytics.inquiries.byStatus.spam).toBe(1);
  });

  test("history survives a project being renamed or removed", async ({ request }) => {
    const { portfolio, slug, token } = await publishedPortfolio("history");
    const auth = { Cookie: `rive_session=${token}` };

    await visit(request, `/p/${slug}/work/case-alpha`, { ip: uniqueIp() });
    await visit(request, `/p/${slug}/work/case-beta`, { ip: uniqueIp() });
    expect(await waitForViews(portfolio.id, 2)).toBe(2);

    // Rename one project and delete the other, exactly as an owner would.
    const content = analyticsContent(`owner-${slug}@example.invalid`);
    await db.prisma.portfolio.update({
      where: { id: portfolio.id },
      data: {
        content: {
          ...content,
          projects: [{ ...content.projects[0], title: "Alpha rebuild (2026 refresh)" }],
        },
      },
    });

    const { analytics } = await (await request.get("/api/portfolio/analytics?range=30d", { headers: auth })).json();

    expect(analytics.totals.projectViews, "removing a project must not erase its history").toBe(2);

    const renamed = analytics.projects.find((project: { projectId: string }) => project.projectId === "case-alpha");
    expect(renamed.title).toBe("Alpha rebuild (2026 refresh)");
    expect(renamed.exists).toBe(true);

    const removed = analytics.projects.find((project: { projectId: string }) => project.projectId === "case-beta");
    expect(removed, "the removed project keeps its recorded views").toBeTruthy();
    expect(removed.exists).toBe(false);
    expect(removed.title).toBe("Removed project");
    expect(removed.views).toBe(1);
  });

  test("analytics are scoped to the signed-in owner", async ({ request }) => {
    const owner = await publishedPortfolio("tenant-owner");
    const other = await publishedPortfolio("tenant-other");

    for (let index = 0; index < 3; index += 1) await visit(request, `/p/${owner.slug}`, { ip: uniqueIp() });
    expect(await waitForViews(owner.portfolio.id, 3)).toBe(3);

    const mine = await (await request.get("/api/portfolio/analytics?range=30d", { headers: { Cookie: `rive_session=${owner.token}` } })).json();
    expect(mine.analytics.totals.views).toBe(3);

    // The other tenant sees only their own portfolio, whatever anyone else's traffic looks like.
    const theirs = await (await request.get("/api/portfolio/analytics?range=30d", { headers: { Cookie: `rive_session=${other.token}` } })).json();
    expect(theirs.analytics.totals.views).toBe(0);
  });

  test("the analytics dashboard is usable on a phone and in dark mode", async ({ page, context, request }) => {
    const { portfolio, slug, token } = await publishedPortfolio("responsive");

    await visit(request, `/p/${slug}`, { ip: uniqueIp() });
    await visit(request, `/p/${slug}/work/case-alpha`, { ip: uniqueIp() });
    await waitForViews(portfolio.id, 2);

    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Analytics/i }).click();

    await expect(page.getByRole("group", { name: /Analytics date range/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Top projects")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Alpha rebuild")).toBeVisible({ timeout: 20_000 });

    // The chart describes itself, carries a scale, and answers a tap with a count
    // in a readout that cannot be clipped by the plot's own scroll container.
    const chart = page.getByRole("img", { name: /Daily views from/i });
    await expect(chart).toBeVisible({ timeout: 20_000 });

    const readout = page.locator("[data-traffic-readout]");
    await expect(readout).toBeVisible();
    // Never empty: with no day selected it falls back to the busiest one.
    // The count and the word sit in adjacent spans, so no whitespace separates
    // them in textContent — the gap between them is layout, not a character.
    await expect(readout).toContainText(/\d+\s*view/i);
    await expect(readout).toContainText(/busiest day/i);

    const bars = page.locator("[data-traffic-bar]");
    expect(await bars.count()).toBeGreaterThan(0);

    /* Tapping a day moves the readout onto it and holds it there — asserted on
       the selection state rather than a formatted date, which would depend on
       the browser's locale. */
    await bars.last().click();
    await expect(readout).not.toContainText(/busiest day/i);
    // The count and the word sit in adjacent spans, so no whitespace separates
    // them in textContent — the gap between them is layout, not a character.
    await expect(readout).toContainText(/\d+\s*view/i);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(
      dimensions.scrollWidth,
      `the analytics dashboard overflows by ${dimensions.scrollWidth - dimensions.clientWidth}px at 390px`,
    ).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    // The range control must actually re-query.
    await page.getByRole("button", { name: "7 days" }).click();
    await expect(page.getByText("Last 7 days")).toBeVisible({ timeout: 20_000 });
  });

  test("a long range stays readable on a phone without the page scrolling sideways", async ({ page, context, request }) => {
    const { portfolio, slug, token } = await publishedPortfolio("chart-wide");

    await visit(request, `/p/${slug}`, { ip: uniqueIp() });
    await waitForViews(portfolio.id, 1);

    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Analytics/i }).click();

    // 90 days of bars is far more than fits on a phone; the plot scrolls inside
    // its own container rather than pushing the page sideways.
    await page.getByRole("button", { name: "90 days" }).click();
    await expect(page.getByRole("img", { name: /Daily views from/i })).toBeVisible({ timeout: 20_000 });
    expect(await page.locator("[data-traffic-bar]").count()).toBeGreaterThan(60);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(
      dimensions.scrollWidth,
      `a 90-day chart overflows the page by ${dimensions.scrollWidth - dimensions.clientWidth}px at 390px`,
    ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
