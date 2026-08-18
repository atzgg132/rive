import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

/**
 * Durable portfolio enquiries, end to end against a real database.
 *
 * The guarantee under test is that a valid enquiry is never lost. CI runs with
 * `EMAIL_PROVIDER=ses` and no credentials, so every notification here genuinely
 * fails to send — which makes this suite a standing check that submission does
 * not depend on the mail provider being reachable.
 */

loadEnvConfig(process.cwd());

const dbChecksEnabled = Boolean(process.env.DATABASE_URL);
const sessionSecret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-development-session-secret";

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

function authHeaders(token: string) {
  return { Cookie: `rive_session=${token}`, "Content-Type": "application/json" };
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

async function createTestUser(label: string): Promise<TestUser> {
  return db.prisma.user.create({
    data: {
      email: `inquiry-${label}-${randomUUID()}@rive.test`,
      name: `Inquiry ${label}`,
      passwordHash: hashPassword("inquiry-test-password"),
      plan: "pro",
      onboardingStatus: "complete",
      businessType: "freelancer",
      currency: "USD",
      timeZone: "UTC",
    },
    select: { id: true, email: true, plan: true, sessionVersion: true },
  });
}

function portfolioContent(contactEmail: string) {
  return {
    name: "Enquiry Fixture",
    profileImageUrl: "",
    headline: "Independent product designer",
    bio: "Fixture portfolio for enquiry tests.",
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

/**
 * Each test gets its own portfolio and slug so the per-portfolio and
 * per-fingerprint buckets never collide with a test running beside it.
 */
async function publishedPortfolio(label: string) {
  const user = await createTestUser(label);
  const slug = `enq-${label}-${randomUUID().slice(0, 8)}`;
  const portfolio = await db.prisma.portfolio.create({
    data: {
      userId: user.id,
      slug,
      status: "published",
      templateKey: "minimal-pro",
      publishedAt: new Date(),
      content: portfolioContent(`owner-${slug}@example.invalid`),
      theme: { accent: "#2563EB", mode: "light", radius: "soft" },
      seo: { title: "Enquiry fixture", description: "Fixture", indexable: false },
    },
    select: { id: true, slug: true },
  });
  return { user, portfolio, slug, token: tokenFor(user) };
}

function submission(overrides: Record<string, unknown> = {}) {
  return {
    name: "Jane Smith",
    email: `visitor-${randomUUID().slice(0, 8)}@example.invalid`,
    projectType: "Website redesign",
    message: `We are rebuilding our marketing site and would like to discuss scope. ${randomUUID()}`,
    ...overrides,
  };
}

function visitorHeaders(ip: string) {
  return { "Content-Type": "application/json", "X-Forwarded-For": ip };
}

/**
 * A fresh address per caller keeps the per-visitor bucket isolated. Counted
 * rather than random, and namespaced per worker and per file, so a collision
 * cannot make one test consume another's allowance. The 11.x space is used
 * here; the analytics suite uses 10.x.
 */
let ipCounter = 0;
function uniqueIp() {
  ipCounter += 1;
  const worker = Number(process.env.TEST_WORKER_INDEX || 0) % 200;
  return `11.${worker}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

/** Matches how the Playwright config resolves its own base URL. */
function baseUrl() {
  return process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${process.env.PLAYWRIGHT_PORT || 3000}`;
}

async function submit(request: APIRequestContext, slug: string, data: Record<string, unknown>, ip = uniqueIp()) {
  return request.post(`/api/public/portfolio/${slug}/inquiries`, { headers: visitorHeaders(ip), data });
}

test.describe("portfolio enquiries", () => {
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

  test("a valid enquiry is persisted and its notification queued in one transaction", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("persist");
    const payload = submission({ sourceProjectId: "case-alpha" });

    const response = await submit(request, slug, payload);
    expect(response.status(), await response.text()).toBe(201);

    const stored = await db.prisma.portfolioInquiry.findMany({ where: { portfolioId: portfolio.id } });
    expect(stored).toHaveLength(1);
    const inquiry = stored[0];

    expect(inquiry.name).toBe("Jane Smith");
    expect(inquiry.email).toBe(payload.email.toLowerCase());
    expect(inquiry.status).toBe("new");
    expect(inquiry.sourceProjectId).toBe("case-alpha");
    expect(inquiry.deviceType).toBeTruthy();

    // Privacy: the visitor is a salted hash, never an address.
    expect(inquiry.visitorHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(inquiry)).not.toContain("203.0.");

    // Atomic with the outbox: the correlation must resolve to a real job.
    expect(inquiry.outboxId).toBeTruthy();
    const job = await db.prisma.emailOutbox.findUnique({ where: { id: inquiry.outboxId as string } });
    expect(job, "the enqueued notification must exist alongside the enquiry").not.toBeNull();
    expect(job?.type).toBe("portfolio_inquiry");
    expect(inquiry.notificationStatus).toBe("queued");
  });

  test("submission succeeds without waiting on the mail provider", async ({ request }) => {
    // CI has no working SES credentials, so a response that depended on delivery
    // could not be a 201 here. This is the regression that lost leads before.
    const { portfolio, slug } = await publishedPortfolio("provider-down");

    const response = await submit(request, slug, submission());
    expect(response.status()).toBe(201);
    expect(await db.prisma.portfolioInquiry.count({ where: { portfolioId: portfolio.id } })).toBe(1);
  });

  test("an unrecognised source project is dropped rather than stored as a phantom", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("bad-source");

    expect((await submit(request, slug, submission({ sourceProjectId: "no-such-project" }))).status()).toBe(201);

    const [inquiry] = await db.prisma.portfolioInquiry.findMany({ where: { portfolioId: portfolio.id } });
    expect(inquiry.sourceProjectId).toBeNull();
  });

  test("a honeypot submission is thanked and stores nothing at all", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("honeypot");

    const response = await submit(request, slug, submission({ website: "http://spam.example" }));
    expect(response.status()).toBe(200);
    expect((await response.json()).success).toBe(true);

    expect(await db.prisma.portfolioInquiry.count({ where: { portfolioId: portfolio.id } })).toBe(0);
    expect(await db.prisma.emailOutbox.count({ where: { recipient: `owner-${slug}@example.invalid` } })).toBe(0);
  });

  test("an oversized body is refused before it is parsed", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("oversized");

    const response = await submit(request, slug, submission({ message: "m".repeat(200_000) }));
    expect(response.status()).toBe(413);
    expect(await db.prisma.portfolioInquiry.count({ where: { portfolioId: portfolio.id } })).toBe(0);
  });

  test("invalid fields are refused and nothing is stored", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("invalid");

    for (const payload of [
      submission({ email: "not-an-email" }),
      submission({ name: "J" }),
      submission({ message: "too short" }),
      submission({ projectType: "" }),
    ]) {
      expect((await submit(request, slug, payload)).status()).toBe(400);
    }
    expect(await db.prisma.portfolioInquiry.count({ where: { portfolioId: portfolio.id } })).toBe(0);
  });

  test("an unpublished portfolio accepts nothing", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("draft");
    await db.prisma.portfolio.update({ where: { id: portfolio.id }, data: { status: "draft" } });

    expect((await submit(request, slug, submission())).status()).toBe(404);
    expect(await db.prisma.portfolioInquiry.count({ where: { portfolioId: portfolio.id } })).toBe(0);
  });

  /* ------------------------------------------------------------------ */
  /* Abuse prevention                                                    */
  /* ------------------------------------------------------------------ */

  test("one visitor is capped per portfolio, with a generic 429 and Retry-After", async ({ request }) => {
    const { slug } = await publishedPortfolio("per-visitor");
    const ip = uniqueIp();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await submit(request, slug, submission(), ip)).status()).toBe(201);
    }

    const blocked = await submit(request, slug, submission(), ip);
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);

    const body = await blocked.json();
    expect(JSON.stringify(body)).not.toContain(slug);
    expect(JSON.stringify(body).toLowerCase()).not.toContain("example.invalid");
  });

  test("one sender address is capped per portfolio even from new addresses", async ({ request }) => {
    const { slug } = await publishedPortfolio("per-sender");
    const email = `repeat-${randomUUID().slice(0, 8)}@example.invalid`;

    // A fresh IP each time, so only the sender cap can be what stops this.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await submit(request, slug, submission({ email }))).status()).toBe(201);
    }
    expect((await submit(request, slug, submission({ email }))).status()).toBe(429);
  });

  test("an identical payload is capped however the sender is disguised", async ({ request }) => {
    const { slug } = await publishedPortfolio("fingerprint");
    const message = `Please quote for a five page marketing site. ${randomUUID()}`;

    // Different address and different sender every time; only the payload repeats.
    expect((await submit(request, slug, submission({ message }))).status()).toBe(201);
    expect((await submit(request, slug, submission({ message }))).status()).toBe(201);

    const blocked = await submit(request, slug, submission({ message: `  ${message.toUpperCase()}  ` }));
    expect(blocked.status(), "cosmetic edits must not mint a fresh fingerprint").toBe(429);
  });

  test("a portfolio has a ceiling on how much mail it can be made to receive", async ({ request }) => {
    const { slug } = await publishedPortfolio("per-portfolio");

    /* Seeded to one below the cap rather than sending twenty live requests:
       this asserts the boundary itself without consuming the global allowance
       that every other test in this suite shares. */
    await db.prisma.rateLimitBucket.upsert({
      where: { key: `portfolio-inquiry:portfolio:${slug}` },
      create: { key: `portfolio-inquiry:portfolio:${slug}`, count: 19, resetAt: new Date(Date.now() + 60 * 60 * 1000) },
      update: { count: 19, resetAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    expect((await submit(request, slug, submission())).status()).toBe(201);

    const blocked = await submit(request, slug, submission());
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
  });

  test("a global ceiling is counted for every submission", async ({ request }) => {
    const { slug } = await publishedPortfolio("global");

    const before = await db.prisma.rateLimitBucket.findUnique({ where: { key: "portfolio-inquiry:global" } });
    expect((await submit(request, slug, submission())).status()).toBe(201);
    const after = await db.prisma.rateLimitBucket.findUnique({ where: { key: "portfolio-inquiry:global" } });

    /* The cap itself is not exhausted here on purpose — draining 200 live
       requests would throttle the rest of the suite. What must hold is that the
       global bucket is durable and advances on every submission, so the ceiling
       is enforced by the same race-safe counter as every other scope. */
    expect(after, "the global ceiling must be counted durably").not.toBeNull();
    expect(after!.resetAt.getTime()).toBeGreaterThan(Date.now());
    if (before && after!.resetAt.getTime() === before.resetAt.getTime()) {
      expect(after!.count).toBeGreaterThan(before.count);
    } else {
      // The hour rolled over mid-test; the window simply restarted.
      expect(after!.count).toBeGreaterThanOrEqual(1);
    }
  });

  test("concurrent submissions cannot exceed the cap between them", async ({ request }) => {
    const { portfolio, slug } = await publishedPortfolio("concurrent");
    const email = `burst-${randomUUID().slice(0, 8)}@example.invalid`;

    // Six at once against a sender cap of three. The counter is conditional on
    // the current count, so an over-issue would show up as a fourth 201.
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => submit(request, slug, submission({ email }))),
    );
    const statuses = responses.map((response) => response.status());

    expect(statuses.filter((status) => status === 201)).toHaveLength(3);
    expect(statuses.filter((status) => status === 429)).toHaveLength(3);
    expect(await db.prisma.portfolioInquiry.count({ where: { portfolioId: portfolio.id } })).toBe(3);
  });

  /* ------------------------------------------------------------------ */
  /* Owner inbox                                                         */
  /* ------------------------------------------------------------------ */

  test("the owner can list, filter, search, read, and move an enquiry through its lifecycle", async ({ request }) => {
    const { slug, token } = await publishedPortfolio("lifecycle");
    const auth = authHeaders(token);

    expect((await submit(request, slug, submission({ name: "Priya Nair", projectType: "Brand film" }))).status()).toBe(201);
    expect((await submit(request, slug, submission({ name: "Tom Reed", projectType: "Web app" }))).status()).toBe(201);

    const listed = await request.get("/api/portfolio/inquiries", { headers: auth });
    expect(listed.status()).toBe(200);
    const list = await listed.json();
    expect(list.total).toBe(2);
    expect(list.unread).toBe(2);
    expect(list.counts.new).toBe(2);
    expect(list.inquiries[0].excerpt).toBeTruthy();

    const search = await request.get("/api/portfolio/inquiries?search=Priya", { headers: auth });
    const searched = await search.json();
    expect(searched.total).toBe(1);
    expect(searched.inquiries[0].name).toBe("Priya Nair");

    const target = searched.inquiries[0].id as string;

    const detail = await request.get(`/api/portfolio/inquiries/${target}`, { headers: auth });
    expect(detail.status()).toBe(200);
    expect((await detail.json()).inquiry.message).toContain("rebuilding our marketing site");

    const read = await request.patch(`/api/portfolio/inquiries/${target}`, { headers: auth, data: { action: "read" } });
    expect((await read.json()).inquiry.status).toBe("read");

    const replied = await request.patch(`/api/portfolio/inquiries/${target}`, { headers: auth, data: { action: "replied" } });
    const repliedBody = await replied.json();
    expect(repliedBody.inquiry.status).toBe("replied");
    expect(repliedBody.inquiry.repliedAt).toBeTruthy();

    const archived = await request.patch(`/api/portfolio/inquiries/${target}`, { headers: auth, data: { action: "archived" } });
    expect((await archived.json()).inquiry.status).toBe("archived");

    // Restoring returns it to the furthest state it genuinely reached.
    const restored = await request.patch(`/api/portfolio/inquiries/${target}`, { headers: auth, data: { action: "restore" } });
    expect((await restored.json()).inquiry.status).toBe("replied");

    const spam = await request.patch(`/api/portfolio/inquiries/${target}`, { headers: auth, data: { action: "spam" } });
    expect((await spam.json()).inquiry.status).toBe("spam");

    const spamOnly = await request.get("/api/portfolio/inquiries?status=spam", { headers: auth });
    expect((await spamOnly.json()).total).toBe(1);

    // Unread is an assertion by the owner, so it must clear the read stamp.
    const other = list.inquiries.find((item: { id: string }) => item.id !== target).id as string;
    await request.patch(`/api/portfolio/inquiries/${other}`, { headers: auth, data: { action: "read" } });
    const unread = await request.patch(`/api/portfolio/inquiries/${other}`, { headers: auth, data: { action: "unread" } });
    const unreadBody = await unread.json();
    expect(unreadBody.inquiry.status).toBe("new");
    expect(unreadBody.inquiry.readAt).toBeNull();
  });

  test("an unknown action is refused", async ({ request }) => {
    const { slug, token } = await publishedPortfolio("bad-action");
    const auth = authHeaders(token);
    expect((await submit(request, slug, submission())).status()).toBe(201);

    const list = await (await request.get("/api/portfolio/inquiries", { headers: auth })).json();
    const target = list.inquiries[0].id as string;

    for (const action of ["delete", "", null, "DROP TABLE"]) {
      const response = await request.patch(`/api/portfolio/inquiries/${target}`, { headers: auth, data: { action } });
      expect(response.status()).toBe(400);
    }
    expect((await request.get("/api/portfolio/inquiries?status=nonsense", { headers: auth })).status()).toBe(400);
  });

  test("another tenant cannot read or mutate an enquiry, and is never told it exists", async ({ request }) => {
    const owner = await publishedPortfolio("tenant-a");
    const intruder = await publishedPortfolio("tenant-b");

    expect((await submit(request, owner.slug, submission({ name: "Confidential Lead" }))).status()).toBe(201);

    const ownerList = await (await request.get("/api/portfolio/inquiries", { headers: authHeaders(owner.token) })).json();
    expect(ownerList.total).toBe(1);
    const target = ownerList.inquiries[0].id as string;

    const intruderAuth = authHeaders(intruder.token);

    // The intruder's own inbox must not contain it.
    const intruderList = await (await request.get("/api/portfolio/inquiries", { headers: intruderAuth })).json();
    expect(intruderList.total).toBe(0);
    expect(JSON.stringify(intruderList)).not.toContain("Confidential Lead");

    // 404, never 403: existence must not leak across tenants.
    expect((await request.get(`/api/portfolio/inquiries/${target}`, { headers: intruderAuth })).status()).toBe(404);
    for (const action of ["read", "unread", "replied", "archived", "spam", "restore"]) {
      const response = await request.patch(`/api/portfolio/inquiries/${target}`, { headers: intruderAuth, data: { action } });
      expect(response.status(), `${action} must not cross tenants`).toBe(404);
    }

    // And the record is genuinely untouched.
    const stored = await db.prisma.portfolioInquiry.findUnique({ where: { id: target } });
    expect(stored?.status).toBe("new");
    expect(stored?.readAt).toBeNull();
  });

  test("the enquiry routes reject anonymous callers", async ({ request }) => {
    const { slug, token } = await publishedPortfolio("anon");
    expect((await submit(request, slug, submission())).status()).toBe(201);
    const list = await (await request.get("/api/portfolio/inquiries", { headers: authHeaders(token) })).json();
    const target = list.inquiries[0].id as string;

    expect((await request.get("/api/portfolio/inquiries")).status()).toBe(401);
    expect((await request.get(`/api/portfolio/inquiries/${target}`)).status()).toBe(401);
    expect((await request.patch(`/api/portfolio/inquiries/${target}`, { data: { action: "read" } })).status()).toBe(401);
    expect((await request.get("/api/portfolio/analytics")).status()).toBe(401);
  });

  test("the enquiry inbox is usable on a phone and in dark mode", async ({ page, context }) => {
    const { slug, token } = await publishedPortfolio("responsive");
    await page.request.post(`/api/public/portfolio/${slug}/inquiries`, {
      headers: visitorHeaders(uniqueIp()),
      data: submission({ name: "Mobile Reader", projectType: "Mobile layout check" }),
    });

    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Enquiries/i }).click();
    await expect(page.getByText("Mobile Reader")).toBeVisible({ timeout: 15_000 });

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(
      dimensions.scrollWidth,
      `the enquiry inbox overflows by ${dimensions.scrollWidth - dimensions.clientWidth}px at 390px`,
    ).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    // Opening a message must reveal it and mark it read.
    await page.getByText("Mobile Reader").click();
    await expect(page.getByRole("link", { name: /Reply by email/i })).toBeVisible({ timeout: 15_000 });
  });
});
