import { loadEnvConfig } from "@next/env";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

loadEnvConfig(process.cwd());

const dbChecksEnabled = Boolean(process.env.DATABASE_URL);
const storageChecksEnabled = Boolean(process.env.ASSET_BUCKET && (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION));

type TestDb = { prisma: PrismaClient; pool: Pool };
type TestUser = { id: string; email: string; plan: string; sessionVersion: number };
type JsonObject = Record<string, unknown>;

let db: TestDb;

const sessionSecret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-development-session-secret";
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "";
const bucket = process.env.ASSET_BUCKET || "";

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

function headers(token: string) {
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

async function json(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<JsonObject> {
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object response.");
  return value as JsonObject;
}

async function createTestUser(label: string): Promise<TestUser> {
  return db.prisma.user.create({
    data: {
      email: `media-${label}-${randomUUID()}@rive.test`,
      name: `Media ${label}`,
      passwordHash: hashPassword("media-test-password"),
      plan: "free",
      onboardingStatus: "in_progress",
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

function mediaContent(extra: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Media Freelancer",
    profileImageUrl: "",
    headline: "I bake and I produce records",
    bio: "Two practices under one roof.",
    location: "Lisbon",
    availability: "Open",
    contactEmail: "media@example.com",
    social: [],
    practices: [
      { id: "bake", slug: "baking", name: "Baking", tagline: "Slow ferments", description: "", order: 0, visibility: "public" as const },
      { id: "music", slug: "music", name: "Music", tagline: "Warm records", description: "", order: 1, visibility: "private" as const },
    ],
    practiceLayout: "unified" as const,
    mediaSettings: { autoplayOnScroll: true, loop: false, hoverPreview: false, lightbox: true, layout: "grid" as const, fit: "cover" as const, showCaptions: true },
    projects: [
      {
        id: "public-bake", title: "Public loaf", description: "A public project.", role: "Baker", year: "2026",
        url: "", imageUrl: "", visibility: "public" as const, practiceId: "bake",
        media: [{ id: "m-embed", kind: "embed" as const, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", alt: "Bake video", caption: "" }],
      },
      {
        id: "hidden-music", title: "PRIVATE_PRACTICE_MUST_NOT_LEAK", description: "Belongs to a hidden practice.", role: "Producer",
        year: "2026", url: "", imageUrl: "", visibility: "public" as const, practiceId: "music", media: [],
      },
    ],
    services: [],
    testimonials: [],
    sections: [
      { key: "about" as const, visible: true }, { key: "projects" as const, visible: true },
      { key: "services" as const, visible: true }, { key: "testimonials" as const, visible: false },
      { key: "contact" as const, visible: true },
    ],
    ...extra,
  };
}

test.describe("portfolio media and practices", () => {
  test.skip(!dbChecksEnabled, "Requires DATABASE_URL with a migrated test database.");
  test.setTimeout(90_000);

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

  test("practice pages resolve, reserved slugs are refused, and hidden practices do not leak", async ({ request, page }) => {
    const user = await createTestUser("practices");
    const auth = headers(tokenFor(user));
    try {
      const created = await json(await request.post("/api/portfolio", { headers: auth, data: {} }));
      const portfolio = created.portfolio as JsonObject;
      const slug = String(portfolio.slug);

      const saved = await request.patch("/api/portfolio", {
        headers: auth,
        data: { revision: Number(portfolio.revision), content: mediaContent(), status: "published" },
      });
      expect(saved.status()).toBe(200);

      // The public payload must not carry the hidden practice or its work.
      const publicBody = JSON.stringify(await json(await request.get(`/api/public/portfolio/${slug}`)));
      expect(publicBody).not.toContain("PRIVATE_PRACTICE_MUST_NOT_LEAK");
      expect(publicBody).toContain("Public loaf");

      // A visible practice has its own page; a hidden one is a 404, as is a
      // case study reached directly inside it.
      expect((await page.goto(`/p/${slug}/baking`, { waitUntil: "domcontentloaded" }))?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Public loaf" })).toBeVisible();
      expect((await page.goto(`/p/${slug}/music`, { waitUntil: "domcontentloaded" }))?.status()).toBe(404);
      expect((await page.goto(`/p/${slug}/work/hidden-music`, { waitUntil: "domcontentloaded" }))?.status()).toBe(404);

      // `work` stays a case-study route and can never be taken by a practice.
      const reserved = await request.patch("/api/portfolio", {
        headers: auth,
        data: {
          revision: Number(((await json(await request.get("/api/portfolio", { headers: auth }))).portfolio as JsonObject).revision),
          content: mediaContent({
            practices: [{ id: "p1", slug: "work", name: "Work", tagline: "", description: "", order: 0, visibility: "public" }],
            projects: [],
          }),
        },
      });
      expect(reserved.status()).toBe(400);
      expect(String((await json(reserved)).message)).toMatch(/reserved/i);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("embeds are re-validated on save, so only allowlisted providers persist", async ({ request }) => {
    const user = await createTestUser("embeds");
    const auth = headers(tokenFor(user));
    try {
      const created = await json(await request.post("/api/portfolio", { headers: auth, data: {} }));
      const portfolio = created.portfolio as JsonObject;

      const hostile = await request.patch("/api/portfolio", {
        headers: auth,
        data: {
          revision: Number(portfolio.revision),
          content: mediaContent({
            practices: [],
            projects: [{
              id: "p1", title: "Hostile", description: "", role: "", year: "2026", url: "", imageUrl: "",
              visibility: "public", media: [{ id: "m1", kind: "embed", url: "https://evil.example.com/player", alt: "", caption: "" }],
            }],
          }),
        },
      });
      expect(hostile.status()).toBe(400);
      expect(String((await json(hostile)).message)).toMatch(/supported provider/i);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("media uploads are kind-aware, quota-tracked, and confirmed against their bytes", async ({ request }) => {
    test.skip(!storageChecksEnabled, "Requires ASSET_BUCKET and an AWS region.");
    const user = await createTestUser("uploads");
    const auth = headers(tokenFor(user));
    const client = new S3Client({ region });
    const created: string[] = [];
    try {
      // A legacy request with no `kind` keeps the original image-only contract.
      const legacyPdf = await request.post("/api/uploads/presign", {
        headers: auth,
        data: { filename: "a.pdf", contentType: "application/pdf", size: 1024, purpose: "portfolio" },
      });
      expect(legacyPdf.status()).toBe(400);

      // An unsupported video container is refused with an actionable message.
      const quicktime = await request.post("/api/uploads/presign", {
        headers: auth,
        data: { filename: "a.mov", contentType: "video/quicktime", size: 1024, purpose: "portfolio", kind: "video" },
      });
      expect(quicktime.status()).toBe(400);
      expect(String((await json(quicktime)).message)).toMatch(/mp4|webm/i);

      // Oversized video is refused before any bytes move.
      const oversize = await request.post("/api/uploads/presign", {
        headers: auth,
        data: { filename: "a.mp4", contentType: "video/mp4", size: 400 * 1024 * 1024, purpose: "portfolio", kind: "video" },
      });
      expect(oversize.status()).toBe(400);

      // A valid request issues a key, records a pending asset, and only turns
      // usable once the uploaded bytes match the declared format.
      const presigned = await json(await request.post("/api/uploads/presign", {
        headers: auth,
        data: { filename: "a.mp4", contentType: "video/mp4", size: 32, purpose: "portfolio", kind: "video" },
      }));
      const key = String(presigned.key);
      created.push(key);
      expect(key).toMatch(new RegExp(`^portfolio/${user.id}/[0-9a-f-]+\\.mp4$`));

      const pending = await db.prisma.portfolioAsset.findUnique({ where: { key } });
      expect(pending?.status).toBe("pending");
      expect(pending?.kind).toBe("video");

      // Upload bytes that are not actually an MP4.
      await client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: Buffer.alloc(32, 0x41), ContentType: "video/mp4",
      }));
      const rejected = await request.post("/api/uploads/commit", { headers: auth, data: { key } });
      expect(rejected.status()).toBe(400);
      expect(String((await json(rejected)).message)).toMatch(/do not match/i);
      // The mismatch removes the record so it cannot count against the quota.
      expect(await db.prisma.portfolioAsset.findUnique({ where: { key } })).toBeNull();

      // A genuine MP4 header confirms successfully.
      const good = await json(await request.post("/api/uploads/presign", {
        headers: auth,
        data: { filename: "b.mp4", contentType: "video/mp4", size: 32, purpose: "portfolio", kind: "video" },
      }));
      const goodKey = String(good.key);
      created.push(goodKey);
      const mp4 = Buffer.alloc(32);
      Buffer.from([0, 0, 0, 0x20]).copy(mp4, 0);
      Buffer.from("ftypisom").copy(mp4, 4);
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: goodKey, Body: mp4, ContentType: "video/mp4" }));
      const confirmed = await request.post("/api/uploads/commit", { headers: auth, data: { key: goodKey } });
      expect(confirmed.status()).toBe(200);
      expect((await db.prisma.portfolioAsset.findUnique({ where: { key: goodKey } }))?.status).toBe("ready");

      // Another account cannot confirm someone else's upload.
      const stranger = await createTestUser("uploads-stranger");
      try {
        const theft = await request.post("/api/uploads/commit", { headers: headers(tokenFor(stranger)), data: { key: goodKey } });
        expect(theft.status()).toBe(404);
      } finally {
        await deleteTestUser(stranger.id);
      }
    } finally {
      for (const key of created) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
      }
      await deleteTestUser(user.id);
    }
  });

  test("a reservation counts against the quota until it is released or confirmed", async ({ request }) => {
    test.skip(!storageChecksEnabled, "Requires ASSET_BUCKET and an AWS region.");
    const user = await createTestUser("reservations");
    const auth = headers(tokenFor(user));
    const client = new S3Client({ region });
    const created: string[] = [];
    try {
      const before = await json(await request.get("/api/portfolio/storage", { headers: auth }));
      const usedBefore = Number((before.storage as JsonObject).usedBytes);

      const presigned = await json(await request.post("/api/uploads/presign", {
        headers: auth,
        data: { filename: "hold.mp4", contentType: "video/mp4", size: 4096, purpose: "portfolio", kind: "video" },
      }));
      const key = String(presigned.key);
      created.push(key);

      // An unconfirmed reservation occupies real space, so it has to show up in
      // reported usage as well as in the cap the presign route enforces.
      const during = await json(await request.get("/api/portfolio/storage", { headers: auth }));
      expect(Number((during.storage as JsonObject).usedBytes)).toBe(usedBefore + 4096);

      // Nobody else can hand back a reservation they do not own.
      const stranger = await createTestUser("reservations-stranger");
      try {
        const theft = await request.delete("/api/uploads/commit", { headers: headers(tokenFor(stranger)), data: { key } });
        expect(theft.status()).toBe(404);
        expect(await db.prisma.portfolioAsset.findUnique({ where: { key } })).not.toBeNull();
      } finally {
        await deleteTestUser(stranger.id);
      }

      // The owner releasing it frees the space immediately rather than waiting
      // for the sweeper.
      const released = await request.delete("/api/uploads/commit", { headers: auth, data: { key } });
      expect(released.status()).toBe(200);
      expect(await db.prisma.portfolioAsset.findUnique({ where: { key } })).toBeNull();

      const after = await json(await request.get("/api/portfolio/storage", { headers: auth }));
      expect(Number((after.storage as JsonObject).usedBytes)).toBe(usedBefore);

      // A confirmed asset is in use, so the abandon path must not delete it.
      const good = await json(await request.post("/api/uploads/presign", {
        headers: auth,
        data: { filename: "keep.mp4", contentType: "video/mp4", size: 32, purpose: "portfolio", kind: "video" },
      }));
      const goodKey = String(good.key);
      created.push(goodKey);
      const mp4 = Buffer.alloc(32);
      Buffer.from([0, 0, 0, 0x20]).copy(mp4, 0);
      Buffer.from("ftypisom").copy(mp4, 4);
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: goodKey, Body: mp4, ContentType: "video/mp4" }));
      expect((await request.post("/api/uploads/commit", { headers: auth, data: { key: goodKey } })).status()).toBe(200);

      const releaseReady = await request.delete("/api/uploads/commit", { headers: auth, data: { key: goodKey } });
      expect(releaseReady.status()).toBe(404);
      expect((await db.prisma.portfolioAsset.findUnique({ where: { key: goodKey } }))?.status).toBe("ready");
    } finally {
      for (const key of created) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
      }
      await deleteTestUser(user.id);
    }
  });

  test("video is redirected to storage so range requests work, while images stream through", async ({ request }) => {
    test.skip(!storageChecksEnabled, "Requires ASSET_BUCKET and an AWS region.");
    const user = await createTestUser("delivery");
    const auth = headers(tokenFor(user));
    const client = new S3Client({ region });
    let key = "";
    try {
      const presigned = await json(await request.post("/api/uploads/presign", {
        headers: auth,
        data: { filename: "c.mp4", contentType: "video/mp4", size: 32, purpose: "portfolio", kind: "video" },
      }));
      key = String(presigned.key);
      const mp4 = Buffer.alloc(32);
      Buffer.from([0, 0, 0, 0x20]).copy(mp4, 0);
      Buffer.from("ftypisom").copy(mp4, 4);
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: mp4, ContentType: "video/mp4" }));
      await request.post("/api/uploads/commit", { headers: auth, data: { key } });

      const response = await request.get(String(presigned.assetUrl), { maxRedirects: 0 });
      expect(response.status()).toBe(302);
      expect(response.headers().location).toContain(bucket);

      // An unknown extension is never addressable, whatever the path looks like.
      expect((await request.get("/api/public/assets/portfolio/x/y.exe")).status()).toBe(404);
    } finally {
      if (key) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
      await deleteTestUser(user.id);
    }
  });
});
