import { loadEnvConfig } from "@next/env";
import { DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHash, createHmac, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { Pool } from "pg";

loadEnvConfig(process.cwd());

const releaseChecksEnabled = Boolean(process.env.DATABASE_URL);
const storageChecksEnabled = Boolean(process.env.ASSET_BUCKET && (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION));

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

function assetKeyFromUrl(assetUrl: string, baseURL: string) {
  const pathname = new URL(assetUrl, baseURL).pathname;
  const prefix = "/api/public/assets/";
  if (!pathname.startsWith(prefix)) throw new Error(`Unexpected managed asset URL: ${assetUrl}`);
  return pathname.slice(prefix.length).split("/").map(decodeURIComponent).join("/");
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
      expect((createdPortfolio.content as JsonObject).projects).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "project-1", visibility: "private" }),
      ]));

      const draftPublicResponse = await request.get(`/api/public/portfolio/${slug}`);
      expect(draftPublicResponse.status()).toBe(404);

      const missingConfirmationResponse = await request.patch("/api/portfolio", {
        headers: auth,
        data: { revision, content: portfolioContent() },
      });
      expect(missingConfirmationResponse.status()).toBe(409);
      expect(await json(missingConfirmationResponse)).toEqual(expect.objectContaining({
        code: "CASE_STUDY_PUBLICATION_CONFIRMATION_REQUIRED",
        caseStudyIds: ["release-public-project"],
      }));

      const savedResponse = await request.patch("/api/portfolio", {
        headers: auth,
        data: {
          revision,
          content: portfolioContent(),
          confirmedPublicProjectIds: ["release-public-project"],
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

      const collisionUser = await createTestUser("portfolio-collision");
      try {
        const collisionAuth = headers(tokenFor(collisionUser));
        const collisionCreatedResponse = await request.post("/api/portfolio", { headers: collisionAuth, data: {} });
        const collisionCreated = await json(collisionCreatedResponse);
        const collisionPortfolio = collisionCreated.portfolio as JsonObject;
        const collisionResponse = await request.patch("/api/portfolio", {
          headers: collisionAuth,
          data: { revision: Number(collisionPortfolio.revision), slug },
        });
        expect(collisionResponse.status()).toBe(409);
      } finally {
        await deleteTestUser(collisionUser.id);
      }

      const nextSlug = `${slug.slice(0, 50 - "-updated".length)}-updated`;
      const renamedResponse = await request.patch("/api/portfolio", {
        headers: auth,
        data: { revision: Number(savedPortfolio.revision), slug: nextSlug, status: "published" },
      });
      expect(renamedResponse.status()).toBe(200);
      const renamed = await json(renamedResponse);
      const persistedRename = await db.prisma.portfolio.findUnique({ where: { userId: user.id }, select: { slug: true } });
      expect(persistedRename?.slug).toBe(nextSlug);
      expect((renamed.portfolio as JsonObject).slug).toBe(nextSlug);
      expect((await request.get(`/api/public/portfolio/${slug}`)).status()).toBe(404);
      expect((await request.get(`/api/public/portfolio/${nextSlug}`)).status()).toBe(200);
      expect((await page.goto(`/p/${slug}`, { waitUntil: "domcontentloaded" }))?.status()).toBe(404);
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
        data: { revision: baseRevision, content: { ...portfolioContent(), name: "First draft" }, confirmedPublicProjectIds: ["release-public-project"] },
      });
      const second = request.patch("/api/portfolio", {
        headers: auth,
        data: { revision: baseRevision, content: { ...portfolioContent(), name: "Second draft" }, confirmedPublicProjectIds: ["release-public-project"] },
      });
      const responses = await Promise.all([first, second]);
      expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
      const conflictBody = await json(responses.find((response) => response.status() === 409)!);
      expect(conflictBody.conflict).toBe(true);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("portfolio uploads require auth, use an owner-scoped S3 key, and deliver the saved asset", async ({ request, baseURL }) => {
    test.skip(!storageChecksEnabled, "Requires ASSET_BUCKET, an AWS region, and live S3 test credentials.");
    const owner = await createTestUser("upload-owner");
    const other = await createTestUser("upload-other");
    const ownerAuth = headers(tokenFor(owner));
    const otherAuth = headers(tokenFor(other));
    const s3 = new S3Client({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });
    const image = Buffer.from("rive-alpha-upload-check", "utf8");
    let assetKey: string | undefined;
    try {
      const unauthorized = await request.post("/api/uploads/presign", {
        data: { filename: "release.png", contentType: "image/png", size: image.length, purpose: "portfolio" },
      });
      expect(unauthorized.status()).toBe(401);

      const invalidType = await request.post("/api/uploads/presign", {
        headers: ownerAuth,
        data: { filename: "release.pdf", contentType: "application/pdf", size: image.length, purpose: "portfolio" },
      });
      expect(invalidType.status()).toBe(400);

      const oversized = await request.post("/api/uploads/presign", {
        headers: ownerAuth,
        data: { filename: "release.png", contentType: "image/png", size: 10 * 1024 * 1024 + 1, purpose: "portfolio" },
      });
      expect(oversized.status()).toBe(400);

      const presignResponse = await request.post("/api/uploads/presign", {
        headers: ownerAuth,
        data: { filename: "release.png", contentType: "image/png", size: image.length, purpose: "portfolio" },
      });
      expect(presignResponse.status()).toBe(200);
      const presigned = await json(presignResponse);
      const uploadUrl = String(presigned.uploadUrl);
      const assetUrl = String(presigned.assetUrl);
      assetKey = assetKeyFromUrl(assetUrl, baseURL!);
      expect(assetKey).toMatch(new RegExp(`^portfolio/${owner.id}/[0-9a-f-]+\\.png$`));

      const upload = await request.put(uploadUrl, {
        headers: (presigned.headers || {}) as Record<string, string>,
        data: image,
      });
      expect(upload.status()).toBe(200);

      const stored = await s3.send(new HeadObjectCommand({ Bucket: process.env.ASSET_BUCKET, Key: assetKey }));
      expect(stored.ContentType).toBe("image/png");
      expect(stored.Metadata).toMatchObject({ owner: owner.id, purpose: "portfolio" });

      const delivered = await request.get(assetUrl);
      expect(delivered.status()).toBe(200);
      expect(delivered.headers()["content-type"]).toContain("image/png");
      expect(await delivered.body()).toEqual(image);

      const createdResponse = await request.post("/api/portfolio", { headers: ownerAuth, data: {} });
      const created = await json(createdResponse);
      const createdPortfolio = created.portfolio as JsonObject;
      const content = portfolioContent();
      content.projects[0]!.imageUrl = assetUrl;
      const savedResponse = await request.patch("/api/portfolio", {
        headers: ownerAuth,
        data: { revision: Number(createdPortfolio.revision), content, confirmedPublicProjectIds: ["release-public-project"] },
      });
      expect(savedResponse.status()).toBe(200);
      const saved = await json(savedResponse);
      expect(JSON.stringify((saved.portfolio as JsonObject).content)).toContain(assetUrl);
      const publicPortfolio = await request.get(`/api/public/portfolio/${String(createdPortfolio.slug)}`);
      expect(publicPortfolio.status()).toBe(404);
      const publishedResponse = await request.patch("/api/portfolio", {
        headers: ownerAuth,
        data: { revision: Number((saved.portfolio as JsonObject).revision), status: "published" },
      });
      expect(publishedResponse.status()).toBe(200);
      const publishedPublicPortfolio = await request.get(`/api/public/portfolio/${String(createdPortfolio.slug)}`);
      expect(publishedPublicPortfolio.status()).toBe(200);
      expect(JSON.stringify(await json(publishedPublicPortfolio))).toContain(assetUrl);

      const otherPresignResponse = await request.post("/api/uploads/presign", {
        headers: otherAuth,
        data: { filename: "other.png", contentType: "image/png", size: image.length, purpose: "portfolio" },
      });
      expect(otherPresignResponse.status()).toBe(200);
      const otherPresigned = await json(otherPresignResponse);
      const otherKey = assetKeyFromUrl(String(otherPresigned.assetUrl), baseURL!);
      expect(otherKey).toMatch(new RegExp(`^portfolio/${other.id}/[0-9a-f-]+\\.png$`));
      expect(otherKey).not.toContain(`/${owner.id}/`);
    } finally {
      if (assetKey) {
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.ASSET_BUCKET, Key: assetKey }));
      }
      await deleteTestUser(owner.id);
      await deleteTestUser(other.id);
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

  test("calendar and project/client associations enforce same-user ownership", async ({ request }) => {
    const owner = await createTestUser("calendar-owner");
    const other = await createTestUser("calendar-other");
    const otherClient = await db.prisma.client.create({ data: { userId: other.id, name: "Other client", tags: [] } });
    const otherProject = await db.prisma.project.create({
      data: { userId: other.id, clientId: otherClient.id, title: "Other project", tags: [], currency: "USD" },
    });
    const ownerAuth = headers(tokenFor(owner));
    try {
      const clients = await request.get("/api/workflow/clients", { headers: ownerAuth });
      expect(clients.status()).toBe(200);
      expect(JSON.stringify(await json(clients))).not.toContain(otherClient.id);

      const projects = await request.get(`/api/workflow/projects?clientId=${otherClient.id}`, { headers: ownerAuth });
      expect(projects.status()).toBe(200);
      expect(JSON.stringify(await json(projects))).not.toContain(otherProject.id);

      const projectResponse = await request.post("/api/workflow/projects", {
        headers: ownerAuth,
        data: { title: "Cross-user project", client_id: otherClient.id, currency: "USD", tags: [], milestones: [] },
      });
      expect(projectResponse.status()).toBe(404);

      const clientResponse = await request.put("/api/workflow/clients", {
        headers: ownerAuth,
        data: { id: otherClient.id, name: "Must not mutate" },
      });
      expect(clientResponse.status()).toBe(404);

      const calendarResponse = await request.post("/api/calendar/events", {
        headers: ownerAuth,
        data: {
          title: "Cross-user calendar attempt",
          startAt: "2030-01-01T10:00:00.000Z",
          endAt: "2030-01-01T11:00:00.000Z",
          timeZone: "UTC",
          clientId: otherClient.id,
          projectId: otherProject.id,
        },
      });
      expect(calendarResponse.status()).toBe(404);
      expect(await db.prisma.calendarEvent.count({ where: { userId: owner.id, title: "Cross-user calendar attempt" } })).toBe(0);
    } finally {
      await deleteTestUser(owner.id);
      await deleteTestUser(other.id);
    }
  });

  test("completed projects keep historical proof dates and emit only one concurrent transition", async ({ request }) => {
    const user = await createTestUser("project-completion");
    const auth = headers(tokenFor(user));
    try {
      const historical = await db.prisma.project.create({
        data: { userId: user.id, title: "Historical completed project", status: "completed", priority: "medium", currency: "USD", tags: [], completedAt: null },
      });
      const edited = await request.put("/api/workflow/projects", {
        headers: auth,
        data: { id: historical.id, title: "Edited historical project" },
      });
      expect(edited.status()).toBe(200);
      expect((await db.prisma.project.findUnique({ where: { id: historical.id }, select: { completedAt: true } }))?.completedAt).toBeNull();

      const statusReplay = await request.patch("/api/workflow/projects/status", {
        headers: auth,
        data: { id: historical.id, status: "completed" },
      });
      expect(statusReplay.status()).toBe(200);
      expect((await db.prisma.project.findUnique({ where: { id: historical.id }, select: { completedAt: true } }))?.completedAt).toBeNull();

      const active = await db.prisma.project.create({
        data: { userId: user.id, title: "Newly completed project", status: "active", priority: "medium", currency: "USD", tags: [] },
      });
      const completions = await Promise.all([
        request.patch("/api/workflow/projects/status", { headers: auth, data: { id: active.id, status: "completed" } }),
        request.patch("/api/workflow/projects/status", { headers: auth, data: { id: active.id, status: "completed" } }),
      ]);
      // Serialized completions are both 200 (second is an idempotent already-completed
      // write). A lost race before the row lock still surfaces as 409.
      expect([[200, 200], [200, 409]]).toContainEqual(completions.map((response) => response.status()).sort());
      const saved = await db.prisma.project.findUnique({ where: { id: active.id }, select: { status: true, completedAt: true } });
      expect(saved?.status).toBe("completed");
      expect(saved?.completedAt).not.toBeNull();
      expect(await db.prisma.productEvent.count({
        where: { userId: user.id, eventName: "project_completed", entityId: active.id },
      })).toBe(1);

      const reopened = await request.patch("/api/workflow/projects/status", {
        headers: auth,
        data: { id: active.id, status: "active" },
      });
      expect(reopened.status()).toBe(200);
      expect((await db.prisma.project.findUnique({ where: { id: active.id }, select: { completedAt: true } }))?.completedAt).toBeNull();
    } finally {
      await deleteTestUser(user.id);
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

      const sourceSelection = await request.patch("/api/onboarding", { headers: auth, data: { sources: ["spreadsheets", "starting_fresh", "spreadsheets"] } });
      expect(sourceSelection.status()).toBe(200);
      const sourceUser = await db.prisma.user.findUnique({ where: { id: user.id }, select: { onboardingData: true } });
      expect((sourceUser?.onboardingData as { sources?: unknown } | null)?.sources).toEqual(["starting_fresh"]);

      const existingSources = await request.patch("/api/onboarding", { headers: auth, data: { sources: ["spreadsheets", "quickbooks", "spreadsheets"] } });
      expect(existingSources.status()).toBe(200);
      const existingSourceUser = await db.prisma.user.findUnique({ where: { id: user.id }, select: { onboardingData: true } });
      expect((existingSourceUser?.onboardingData as { sources?: unknown } | null)?.sources).toEqual(["spreadsheets", "quickbooks"]);

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

  test("automatic guidance persists, manual replay adapts, and state stays isolated per user", async ({ request }) => {
    const user = await createTestUser("guidance-owner");
    const other = await createTestUser("guidance-other");
    const auth = headers(tokenFor(user));
    const otherAuth = headers(tokenFor(other));
    try {
      const onboarding = await request.patch("/api/onboarding", {
        headers: auth,
        data: { goal: "organize", startingPath: "clean", status: "complete", step: 5 },
      });
      expect(onboarding.status()).toBe(200);

      const initial = await request.get("/api/activation", { headers: auth });
      expect(initial.status()).toBe(200);
      expect((await json(initial)).activation).toEqual(expect.objectContaining({
        goal: "organize",
        startingPath: "clean",
        automaticGuidanceStatus: "available",
        guidanceDismissed: false,
        activationStage: "start",
      }));

      const started = await request.post("/api/guidance", { headers: auth, data: { event: "started", mode: "automatic", guideId: "getting_started" } });
      expect(started.status()).toBe(200);
      const skipped = await request.post("/api/guidance", { headers: auth, data: { event: "skipped", mode: "automatic", guideId: "getting_started" } });
      expect(skipped.status()).toBe(200);
      const dismissed = await request.get("/api/activation", { headers: auth });
      expect((await json(dismissed)).activation).toEqual(expect.objectContaining({ guidanceDismissed: true, automaticGuidanceStatus: "dismissed" }));

      const replayed = await request.post("/api/guidance", { headers: auth, data: { event: "replayed", mode: "manual", guideId: "organize" } });
      expect(replayed.status()).toBe(200);
      const replayState = await request.get("/api/activation", { headers: auth });
      expect((await json(replayState)).activation).toEqual(expect.objectContaining({ startingPath: "clean", guidanceDismissed: true, automaticGuidanceStatus: "dismissed" }));

      const client = await request.post("/api/workflow/clients", { headers: auth, data: { name: "Guidance client", tags: [] } });
      expect(client.status()).toBe(201);
      const advanced = await request.get("/api/activation", { headers: auth });
      const advancedPayload = await json(advanced) as { activation?: { recommendedAction?: unknown } };
      expect(advancedPayload.activation?.recommendedAction).toEqual(expect.objectContaining({ id: "first_project" }));

      const otherActivation = await request.get("/api/activation", { headers: otherAuth });
      expect((await json(otherActivation)).activation).toEqual(expect.objectContaining({ guidanceDismissed: false, automaticGuidanceStatus: "available" }));
      expect(await db!.prisma.auditEvent.count({ where: { userId: user.id, action: "guidance.skipped" } })).toBe(1);
      expect(await db!.prisma.auditEvent.count({ where: { userId: other.id, action: "guidance.skipped" } })).toBe(0);
    } finally {
      await deleteTestUser(user.id);
      await deleteTestUser(other.id);
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

  test("manual invoice numbering skips historical collisions, reconciles explicit formats, and serializes concurrent drafts", async ({ request }) => {
    const user = await createTestUser("invoice-numbering");
    const auth = headers(tokenFor(user));
    const invoicePayload = (overrides: Record<string, unknown> = {}) => ({
      currency: "USD",
      issue_date: "2026-09-02",
      items: [{ description: "Invoice numbering coverage", quantity: 1, unit_price: 125 }],
      ...overrides,
    });
    try {
      await db.prisma.invoice.create({
        data: {
          userId: user.id,
          invoiceNumber: "INV-2026-0001",
          status: "draft",
          currency: "USD",
          subtotal: 125,
          total: 125,
          dataOrigin: "imported",
          issueDate: new Date("2026-09-01T00:00:00.000Z"),
        },
      });

      const first = await request.post("/api/workflow/invoices", { headers: auth, data: invoicePayload() });
      expect(first.status()).toBe(201);
      expect((await json(first)).invoice).toEqual(expect.objectContaining({ invoiceNumber: "INV-2026-0002" }));

      const duplicate = await request.post("/api/workflow/invoices", {
        headers: auth,
        data: invoicePayload({ invoice_number: "INV-2026-0001" }),
      });
      expect(duplicate.status()).toBe(409);
      expect((await json(duplicate)).message).toContain('Invoice number "INV-2026-0001" is already in use.');

      const concurrent = await Promise.all([
        request.post("/api/workflow/invoices", { headers: auth, data: invoicePayload() }),
        request.post("/api/workflow/invoices", { headers: auth, data: invoicePayload() }),
      ]);
      expect(concurrent.map((response) => response.status()).sort()).toEqual([201, 201]);
      const concurrentNumbers = (await Promise.all(concurrent.map(json))).map((body) => String((body.invoice as JsonObject).invoiceNumber)).sort();
      expect(concurrentNumbers).toEqual(["INV-2026-0003", "INV-2026-0004"]);

      await db.prisma.invoice.create({
        data: {
          userId: user.id,
          invoiceNumber: "RIVE-2025-0099",
          status: "draft",
          currency: "USD",
          subtotal: 125,
          total: 125,
          dataOrigin: "imported",
          issueDate: new Date("2025-09-01T00:00:00.000Z"),
        },
      });
      const failedExplicitRetry = await request.post("/api/workflow/invoices", {
        headers: auth,
        data: invoicePayload({ invoice_number: "RIVE-2025-0099" }),
      });
      expect(failedExplicitRetry.status()).toBe(409);
      const afterFailedExplicit = await request.post("/api/workflow/invoices", { headers: auth, data: invoicePayload() });
      expect(afterFailedExplicit.status()).toBe(201);
      expect((await json(afterFailedExplicit)).invoice).toEqual(expect.objectContaining({ invoiceNumber: "INV-2026-0005" }));

      const explicit = await request.post("/api/workflow/invoices", {
        headers: auth,
        data: invoicePayload({ invoice_number: "RIVE-2025-0042" }),
      });
      expect(explicit.status()).toBe(201);

      const afterExplicit = await request.post("/api/workflow/invoices", { headers: auth, data: invoicePayload() });
      expect(afterExplicit.status()).toBe(201);
      expect((await json(afterExplicit)).invoice).toEqual(expect.objectContaining({ invoiceNumber: "INV-2026-0043" }));

      const sequence = await db.prisma.invoiceNumberSequence.findUnique({ where: { userId: user.id }, select: { nextNumber: true } });
      expect(sequence?.nextNumber).toBe(44);
      expect(await db.prisma.invoice.count({ where: { userId: user.id } })).toBe(8);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("onboarding invoice imports reconcile generated-format numbers before the next manual draft", async ({ request }) => {
    const user = await createTestUser("invoice-import");
    const auth = headers(tokenFor(user));
    try {
      const imported = await request.post("/api/onboarding/import", {
        headers: { Cookie: `rive_session=${tokenFor(user)}` },
        multipart: {
          mode: "commit",
          source: "release-test",
          files: {
            name: "invoices-generated.csv",
            mimeType: "text/csv",
            buffer: Buffer.from("invoice_no,total,currency,issue_date\nINV-2026-0100,100,USD,2026-09-02\n", "utf8"),
          },
        },
      });
      expect(imported.status()).toBe(200);
      expect((await json(imported)).counts).toEqual(expect.objectContaining({ invoices: 1 }));

      const next = await request.post("/api/workflow/invoices", {
        headers: auth,
        data: { currency: "USD", issue_date: "2026-09-02", items: [{ description: "After import", quantity: 1, unit_price: 50 }] },
      });
      expect(next.status()).toBe(201);
      expect((await json(next)).invoice).toEqual(expect.objectContaining({ invoiceNumber: "INV-2026-0101" }));
      const sequence = await db.prisma.invoiceNumberSequence.findUnique({ where: { userId: user.id }, select: { nextNumber: true } });
      expect(sequence?.nextNumber).toBe(102);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("portfolio and dashboard load failures remain visible instead of becoming empty state", async ({ context, page, baseURL }) => {
    const user = await createTestUser("visible-errors");
    await db.prisma.user.update({ where: { id: user.id }, data: { onboardingStatus: "complete", onboardingStep: 7 } });
    await authenticateBrowser(context, baseURL!, tokenFor(user));

    try {
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
      await expect(page.getByRole("heading", { name: "Your portfolio could not be loaded" })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: /^Save/ })).toHaveCount(0);
      expect(portfolioPostCalls).toBe(0);

      await page.unroute("**/api/portfolio");
      await page.route("**/api/workflow/dashboard", async (route) => {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "Database unavailable" }) });
      });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Your workspace could not be loaded" })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Retry dashboard" })).toBeVisible({ timeout: 15_000 });
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
