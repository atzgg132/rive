import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHash, createHmac, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";

loadEnvConfig(process.cwd());

const releaseChecksEnabled = Boolean(process.env.DATABASE_URL && process.env.E2E_USER_EMAIL);

type TestDb = {
  prisma: PrismaClient;
  pool: Pool;
};

type TestUser = {
  id: string;
  email: string;
  plan: string;
  sessionVersion: number;
};

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
  return process.env.DATABASE_SSL === "disable" || process.env.DATABASE_URL?.includes("sslmode=disable")
    ? false
    : { rejectUnauthorized: false };
}

async function json(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<JsonObject> {
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object response.");
  return value as JsonObject;
}

function headers(token: string, extra: Record<string, string> = {}) {
  return {
    Cookie: `rive_session=${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function tokenFor(user: TestUser) {
  return generateUserToken(user.id, user.email, user.plan, user.sessionVersion);
}

async function createTestUser(label: string): Promise<TestUser> {
  const email = `alpha-rc-${label}-${randomUUID()}@rive.test`;
  return db.prisma.user.create({
    data: {
      email,
      name: `Alpha RC ${label}`,
      passwordHash: hashPassword("alpha-release-test-password"),
      plan: "free",
      onboardingStatus: "in_progress",
      onboardingStep: 1,
      businessType: "freelancer",
      businessTypes: ["freelancer"],
      currency: "USD",
      timeZone: "UTC",
    },
    select: { id: true, email: true, plan: true, sessionVersion: true },
  });
}

async function deleteTestUser(userId: string) {
  await db.prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
}

async function addPasswordResetToken(user: TestUser) {
  const token = randomUUID();
  await db.prisma.authToken.create({
    data: {
      email: user.email,
      userId: user.id,
      type: "password_reset",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return token;
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

function portfolioContent() {
  return {
    name: "Alpha RC Freelancer",
    profileImageUrl: "",
    headline: "Product designer for useful digital products",
    bio: "I help teams turn complex workflows into clear, useful products.",
    location: "Bengaluru",
    availability: "Available now",
    contactEmail: "alpha-rc@example.com",
    social: [],
    projects: [
      {
        id: "release-public-project",
        title: "Public project",
        description: "A public project description.",
        role: "Product designer",
        year: "2026",
        url: "",
        imageUrl: "",
        client: "Independent project",
        timeline: "3 months",
        deliverables: [],
        gallery: [],
        visibility: "public" as const,
        challenge: "",
        solution: "",
        outcome: "",
        tools: [],
      },
      {
        id: "release-private-project",
        title: "PRIVATE_PROJECT_MUST_NOT_LEAK",
        description: "Private project details.",
        role: "Product designer",
        year: "2026",
        url: "",
        imageUrl: "",
        client: "Private client",
        timeline: "",
        deliverables: [],
        gallery: [],
        visibility: "private" as const,
        challenge: "",
        solution: "",
        outcome: "",
        tools: [],
      },
    ],
    services: [],
    testimonials: [
      {
        id: "release-private-testimonial",
        quote: "PRIVATE_TESTIMONIAL_MUST_NOT_LEAK",
        name: "Historical client",
        company: "",
        role: "",
        projectId: "release-private-project",
        source: "Imported manually",
        visibility: "private" as const,
      },
    ],
    sections: [
      { key: "about" as const, visible: true },
      { key: "projects" as const, visible: true },
      { key: "services" as const, visible: true },
      { key: "testimonials" as const, visible: true },
      { key: "contact" as const, visible: true },
    ],
  };
}

test.describe("release-critical persistence, isolation, and activation", () => {
  test.skip(!releaseChecksEnabled, "Requires DATABASE_URL and E2E_USER_EMAIL with a migrated test database.");
  test.setTimeout(90_000);

  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for release-critical tests.");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig() });
    db = { pool, prisma: new PrismaClient({ adapter: new PrismaPg(pool) }) };
    await db.prisma.$queryRaw`SELECT 1`;
  });

  test.afterAll(async () => {
    await db?.prisma.$disconnect();
    await db?.pool.end();
  });

  test("portfolio draft, publish, slug change, and private content boundaries persist", async ({ request, page }) => {
    const user = await createTestUser("portfolio");
    const auth = headers(tokenFor(user));
    try {
      const createdResponse = await request.post("/api/portfolio", { headers: auth, data: {} });
      expect(createdResponse.status()).toBe(201);
      const created = await json(createdResponse);
      const createdPortfolio = created.portfolio as JsonObject;
      const slug = String(createdPortfolio.slug);
      const revision = Number(createdPortfolio.revision);

      const draftPublicResponse = await request.get(`/api/public/portfolio/${slug}`);
      expect(draftPublicResponse.status()).toBe(404);

      const savedResponse = await request.patch("/api/portfolio", {
        headers: auth,
        data: {
          revision,
          content: portfolioContent(),
          status: "published",
          seo: { title: "Alpha RC portfolio", description: "Release candidate portfolio" },
        },
      });
      expect(savedResponse.status()).toBe(200);
      const saved = await json(savedResponse);
      const savedPortfolio = saved.portfolio as JsonObject;
      expect(savedPortfolio.status).toBe("published");

      const persistedResponse = await request.get("/api/portfolio", { headers: auth });
      const persisted = await json(persistedResponse);
      expect((persisted.portfolio as JsonObject).content).toEqual(expect.objectContaining({ name: "Alpha RC Freelancer" }));

      const publicResponse = await request.get(`/api/public/portfolio/${slug}`);
      expect(publicResponse.status()).toBe(200);
      const publicBody = await json(publicResponse);
      const publicJson = JSON.stringify(publicBody);
      expect(publicJson).not.toContain("PRIVATE_PROJECT_MUST_NOT_LEAK");
      expect(publicJson).not.toContain("PRIVATE_TESTIMONIAL_MUST_NOT_LEAK");
      expect(publicJson).toContain("Public project");

      const publicPage = await page.goto(`/p/${slug}`, { waitUntil: "domcontentloaded" });
      expect(publicPage?.status()).toBe(200);
      await expect(page.getByText("Alpha RC Freelancer").first()).toBeVisible();

      const nextSlug = `${slug}-updated`;
      const renamedResponse = await request.patch("/api/portfolio", {
        headers: auth,
        data: { revision: Number(savedPortfolio.revision), slug: nextSlug, status: "published" },
      });
      expect(renamedResponse.status()).toBe(200);
      expect((await request.get(`/api/public/portfolio/${slug}`)).status()).toBe(404);
      expect((await request.get(`/api/public/portfolio/${nextSlug}`)).status()).toBe(200);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("portfolio optimistic concurrency returns a conflict instead of overwriting a newer draft", async ({ request }) => {
    const user = await createTestUser("portfolio-conflict");
    const auth = headers(tokenFor(user));
    try {
      const createdResponse = await request.post("/api/portfolio", { headers: auth, data: {} });
      const created = await json(createdResponse);
      const createdPortfolio = created.portfolio as JsonObject;
      const baseRevision = Number(createdPortfolio.revision);
      const first = request.patch("/api/portfolio", {
        headers: auth,
        data: { revision: baseRevision, content: { ...portfolioContent(), name: "First draft" } },
      });
      const second = request.patch("/api/portfolio", {
        headers: auth,
        data: { revision: baseRevision, content: { ...portfolioContent(), name: "Second draft" } },
      });
      const responses = await Promise.all([first, second]);
      expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
      const conflictBody = await json(responses.find((response) => response.status() === 409)!);
      expect(conflictBody.conflict).toBe(true);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("expense project associations enforce same-user ownership on create and update", async ({ request }) => {
    const owner = await createTestUser("expense-owner");
    const other = await createTestUser("expense-other");
    const ownerProject = await db.prisma.project.create({ data: { userId: owner.id, title: "Owner project", tags: [], currency: "USD" } });
    const otherProject = await db.prisma.project.create({ data: { userId: other.id, title: "Other project", tags: [], currency: "USD" } });
    const auth = headers(tokenFor(owner));
    try {
      const ownResponse = await request.post("/api/workflow/expenses", {
        headers: auth,
        data: { project_id: ownerProject.id, description: "Hosting", amount: 25, currency: "USD" },
      });
      expect(ownResponse.status()).toBe(201);
      const own = await json(ownResponse);
      const expenseId = String((own.expense as JsonObject).id);

      const crossUserCreate = await request.post("/api/workflow/expenses", {
        headers: auth,
        data: { project_id: otherProject.id, description: "Cross-user attempt", amount: 99, currency: "USD" },
      });
      expect(crossUserCreate.status()).toBe(404);

      const crossUserUpdate = await request.put("/api/workflow/expenses", {
        headers: auth,
        data: { id: expenseId, project_id: otherProject.id, description: "Cross-user update", amount: 99, currency: "USD" },
      });
      expect(crossUserUpdate.status()).toBe(404);

      const unchanged = await db.prisma.expense.findUnique({ where: { id: expenseId }, select: { userId: true, projectId: true, amount: true } });
      expect(unchanged).toMatchObject({ userId: owner.id, projectId: ownerProject.id });
      expect(unchanged?.amount.toString()).toBe("25");
    } finally {
      await deleteTestUser(owner.id);
      await deleteTestUser(other.id);
    }
  });

  test("onboarding rejects empty or unknown roles, persists multi-select, and deduplicates activation", async ({ request }) => {
    const user = await createTestUser("onboarding");
    const auth = headers(tokenFor(user), { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}` });
    try {
      const empty = await request.patch("/api/onboarding", { headers: auth, data: { businessTypes: [] } });
      expect(empty.status()).toBe(400);
      const invalid = await request.patch("/api/onboarding", { headers: auth, data: { businessTypes: ["freelancer", "not-a-rive-role"] } });
      expect(invalid.status()).toBe(400);

      const valid = await request.patch("/api/onboarding", { headers: auth, data: { businessTypes: ["freelancer", "contractor"] } });
      expect(valid.status()).toBe(200);
      const savedUser = await db.prisma.user.findUnique({ where: { id: user.id }, select: { businessType: true, businessTypes: true } });
      expect(savedUser).toEqual({ businessType: "freelancer", businessTypes: ["freelancer", "contractor"] });

      const started = await Promise.all([
        request.patch("/api/onboarding", { headers: auth, data: { step: 1, status: "in_progress" } }),
        request.patch("/api/onboarding", { headers: auth, data: { step: 1, status: "in_progress" } }),
      ]);
      expect(started.map((response) => response.status()).sort()).toEqual([200, 200]);
      const events = await db.prisma.auditEvent.count({ where: { userId: user.id, action: "activation.onboarding_started" } });
      expect(events).toBe(1);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("password reset invalidates all prior signed sessions", async ({ request }) => {
    const user = await createTestUser("password-reset");
    const oldToken = tokenFor(user);
    const authToken = await addPasswordResetToken(user);
    try {
      const reset = await request.post("/api/auth/reset-password", {
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.17" },
        data: { token: authToken, password: "new-alpha-release-password" },
      });
      expect(reset.status()).toBe(200);

      const oldSession = await request.get("/api/auth/session", { headers: { Cookie: `rive_session=${oldToken}` } });
      expect(oldSession.status()).toBe(401);

      const current = await db.prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, plan: true, sessionVersion: true } });
      expect(current).not.toBeNull();
      const newToken = generateUserToken(current!.id, current!.email, current!.plan, current!.sessionVersion);
      const newSession = await request.get("/api/auth/session", { headers: { Cookie: `rive_session=${newToken}` } });
      expect(newSession.status()).toBe(200);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("client to project to contract to invoice preserves ownership and currency", async ({ request }) => {
    const user = await createTestUser("workflow");
    const auth = headers(tokenFor(user));
    try {
      const clientResponse = await request.post("/api/workflow/clients", {
        headers: auth,
        data: { name: "Release client", email: "release-client@example.com", tags: [] },
      });
      expect(clientResponse.status()).toBe(201);
      const client = (await json(clientResponse)).client as JsonObject;

      const projectResponse = await request.post("/api/workflow/projects", {
        headers: auth,
        data: { title: "Release project", client_id: client.id, currency: "EUR", status: "active", priority: "medium", tags: [], milestones: [] },
      });
      expect(projectResponse.status()).toBe(201);
      const project = (await json(projectResponse)).project as JsonObject;

      const contractResponse = await request.post("/api/workflow/contracts", {
        headers: auth,
        data: { title: "Release contract", clientId: client.id, projectId: project.id, currency: "EUR" },
      });
      expect(contractResponse.status()).toBe(201);
      const contract = await json(contractResponse);

      const invoiceResponse = await request.post("/api/workflow/invoices", {
        headers: auth,
        data: {
          invoice_number: `RC-${Date.now()}-${randomUUID().slice(0, 8)}`,
          client_id: client.id,
          project_id: project.id,
          currency: "EUR",
          items: [{ description: "Discovery", quantity: 1, unit_price: 125 }],
        },
      });
      expect(invoiceResponse.status()).toBe(201);
      const invoice = (await json(invoiceResponse)).invoice as JsonObject;
      expect(invoice.currency).toBe("EUR");
      expect(String(invoice.total)).toBe("125");

      const persisted = await db.prisma.invoice.findUnique({ where: { id: String(invoice.id) }, select: { userId: true, clientId: true, projectId: true, currency: true, total: true } });
      expect(persisted).toMatchObject({ userId: user.id, clientId: client.id, projectId: project.id, currency: "EUR" });
      expect(persisted?.total.toString()).toBe("125");
      expect(contract.contractId).toBeTruthy();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("portfolio and dashboard load failures remain visible instead of becoming empty state", async ({ context, page, baseURL }) => {
    const email = process.env.E2E_USER_EMAIL!.trim().toLowerCase();
    const user = await db.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, plan: true, sessionVersion: true } });
    expect(user).not.toBeNull();
    await authenticateBrowser(context, baseURL!, generateUserToken(user!.id, user!.email, user!.plan, user!.sessionVersion));

    let portfolioPostCalls = 0;
    await page.route("**/api/portfolio", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "Database unavailable" }) });
      } else {
        portfolioPostCalls += 1;
        await route.continue();
      }
    });
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your portfolio could not be loaded" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Save/ })).toHaveCount(0);
    expect(portfolioPostCalls).toBe(0);

    await page.unroute("**/api/portfolio");
    await page.route("**/api/workflow/dashboard", async (route) => {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "Database unavailable" }) });
    });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your workspace could not be loaded" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry dashboard" })).toBeVisible();
  });
});
