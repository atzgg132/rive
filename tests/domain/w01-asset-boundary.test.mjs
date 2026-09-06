import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

// W01 (D5): the REAL public-asset handler against the REAL isolated Postgres
// (auth stubbed; object storage stubbed and observed so the test proves the
// 404 happens BEFORE any storage read). Fixtures use unique labels per run
// and are never deleted.

const W01_DATABASE_URL =
  process.env.W01_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://arnav_bhattacharya@127.0.0.1:5434/rive_w01?sslmode=disable";
process.env.DATABASE_URL = W01_DATABASE_URL;
process.env.DATABASE_SSL = process.env.DATABASE_SSL || "disable";
process.env.ASSET_BUCKET = process.env.ASSET_BUCKET || "w01-test-bucket";
process.env.AWS_REGION = process.env.AWS_REGION || "us-east-1";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const { prisma } = await import("../../src/utils/db.ts");
const { getPublicPortfolioContent, isPortfolioPublished } = await import("../../src/utils/portfolio.ts");
const portfolioMedia = await import("../../src/utils/portfolioMedia.ts");

const routeSource = readFileSync(
  new URL("../../src/app/api/public/assets/[...key]/route.ts", import.meta.url),
  "utf8",
);
const compiledRoute = ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const RUN = Date.now().toString(36);
const OWNER_EMAIL = `w01-asset-${RUN}@test.invalid`;

let pgAvailable = true;
let ownerId = "";
const session = { userId: "" };

// ---- Storage double: records every read so tests prove authorization first.
const storageCalls = [];
let storageMode = "ok";
const IMAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0x42]);

class FakeGetObjectCommand {
  constructor(input) {
    this.input = input;
  }
}

class FakeS3Client {
  constructor() {}
  async send(command) {
    storageCalls.push({ ...command.input });
    if (storageMode === "missing") {
      const error = new Error("NoSuchKey");
      error.name = "NoSuchKey";
      throw error;
    }
    const input = command.input;
    if (input.Range && storageMode !== "range") {
      // fall through: only range-aware tests set storageMode = "range"
    }
    return {
      Body: {
        transformToWebStream: () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(IMAGE_BYTES);
              controller.close();
            },
          }),
      },
      ContentLength: IMAGE_BYTES.length,
      ETag: '"w01etag"',
      AcceptRanges: "bytes",
      ...(input.Range ? { ContentRange: `bytes 0-${IMAGE_BYTES.length - 1}/${IMAGE_BYTES.length}` } : {}),
    };
  }
}

function loadHandler() {
  const handlerExports = {};
  runInNewContext(compiledRoute, {
    exports: handlerExports,
    console,
    process,
    URL,
    Headers,
    Request,
    Response,
    ReadableStream,
    BigInt,
    require: (name) => {
      if (name === "@aws-sdk/client-s3") {
        return { GetObjectCommand: FakeGetObjectCommand, S3Client: FakeS3Client };
      }
      if (name === "@/utils/db") return { prisma, Prisma: require("@prisma/client").Prisma };
      if (name === "@/utils/userAuth") {
        return { getSessionUser: async () => (session.userId ? { userId: session.userId } : null) };
      }
      if (name === "@/utils/portfolio") return { getPublicPortfolioContent, isPortfolioPublished };
      if (name === "@/utils/portfolioMedia") return portfolioMedia;
      return require(name);
    },
  });
  return handlerExports;
}

let GET = null;

function urlFor(key) {
  return `/api/public/assets/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function get(key, headers = {}) {
  const segments = key.split("/").map(encodeURIComponent).join("/");
  return GET(
    new Request(`https://rive.test/api/public/assets/${segments}`, { headers }),
    { params: Promise.resolve({ key: key.split("/") }) },
  );
}

function requirePg(t) {
  if (!pgAvailable) t.skip("isolated Postgres unreachable — start the WSL cluster on :5434");
}

let publicImageKey = "";
let publicVideoKey = "";
let publicPosterKey = "";
let privateImageKey = "";
let unreferencedKey = "";
let hiddenProfileKey = "";
let slug = "";

function contentWith() {
  return {
    name: "W01 boundary fixture",
    profileImageUrl: urlFor(hiddenProfileKey),
    profileImageSourceUrl: urlFor(privateImageKey),
    showProfileImage: false,
    tagline: "",
    headline: "Public fixture",
    bio: "Synthetic portfolio used only by the D5 handler contract.",
    location: "",
    availability: "",
    contactEmail: "w01-asset@test.invalid",
    social: [],
    projects: [
      {
        id: "public-project",
        title: "Public project",
        description: "Visible to visitors.",
        role: "Designer",
        year: "2026",
        url: "",
        imageUrl: urlFor(publicImageKey),
        visibility: "public",
        media: [{
          id: "public-video",
          kind: "video",
          url: urlFor(publicVideoKey),
          posterUrl: urlFor(publicPosterKey),
          alt: "Public video",
          caption: "",
        }],
      },
      {
        id: "private-project",
        title: "Private project",
        description: "Never visible to visitors.",
        role: "Designer",
        year: "2026",
        url: "",
        imageUrl: urlFor(privateImageKey),
        visibility: "private",
        media: [],
      },
    ],
    services: [],
    testimonials: [],
    sections: [],
    practices: [],
  };
}

before(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    pgAvailable = false;
    return;
  }
  GET = loadHandler().GET;
  ownerId = (await prisma.user.create({
    data: { email: OWNER_EMAIL, passwordHash: "scrypt:w01:w01", timeZone: "UTC" },
  })).id;
  const hex = (n) => n.toString(16);
  const file = (n) => `0000000${hex(n)}-0000-4000-8000-00000000000${hex(n)}`;
  publicImageKey = `portfolio/${ownerId}/${file(0xa11ce)}.jpg`;
  publicVideoKey = `portfolio/${ownerId}/${file(0xb22ce)}.mp4`;
  publicPosterKey = `portfolio/${ownerId}/${file(0xc33ce)}.jpg`;
  privateImageKey = `portfolio/${ownerId}/${file(0xd44ce)}.jpg`;
  unreferencedKey = `portfolio/${ownerId}/${file(0xe55ce)}.jpg`;
  hiddenProfileKey = `portfolio/${ownerId}/${file(0xf66ce)}.jpg`;
  slug = `w01-asset-${RUN}`;
  await prisma.portfolio.create({
    data: { userId: ownerId, slug, status: "published", content: contentWith(), theme: {} },
  });
  session.userId = "";
});

after(async () => {
  await prisma.$disconnect().catch(() => undefined);
});

test("D5: a referenced public asset streams with private,no-store", async (t) => {
  requirePg(t);
  session.userId = "";
  storageCalls.length = 0;
  const response = await get(publicImageKey);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Content-Type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(IMAGE_BYTES));
  assert.equal(storageCalls.length, 1);
  assert.equal(storageCalls[0].Key, publicImageKey);
});

test("D5: an unreferenced key is a uniform 404 before any storage read", async (t) => {
  requirePg(t);
  session.userId = "";
  storageCalls.length = 0;
  const response = await get(unreferencedKey);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: "Asset not found." });
  assert.equal(storageCalls.length, 0);
});

test("D5: assets of private projects and hidden profile photos stay 404", async (t) => {
  requirePg(t);
  session.userId = "";
  storageCalls.length = 0;
  for (const key of [privateImageKey, hiddenProfileKey]) {
    const response = await get(key);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { message: "Asset not found." });
  }
  assert.equal(storageCalls.length, 0);
});

test("D5: unpublishing revokes the bytes even for still-referenced keys", async (t) => {
  requirePg(t);
  session.userId = "";
  await prisma.portfolio.update({ where: { userId: ownerId }, data: { status: "draft" } });
  try {
    storageCalls.length = 0;
    const response = await get(publicImageKey);
    assert.equal(response.status, 404);
    assert.equal(storageCalls.length, 0);
  } finally {
    await prisma.portfolio.update({ where: { userId: ownerId }, data: { status: "published" } });
  }
  storageCalls.length = 0;
  assert.equal((await get(publicImageKey)).status, 200);
});

test("D5: the owner still previews drafts while strangers see 404", async (t) => {
  requirePg(t);
  storageCalls.length = 0;
  session.userId = ownerId;
  try {
    const preview = await get(unreferencedKey);
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("Cache-Control"), "private, no-store");
  } finally {
    session.userId = "";
  }
  storageCalls.length = 0;
  assert.equal((await get(unreferencedKey)).status, 404);
  assert.equal(storageCalls.length, 0);
});

test("D5: range requests proxy as 206 and malformed ranges are rejected", async (t) => {
  requirePg(t);
  session.userId = "";
  storageMode = "range";
  try {
    storageCalls.length = 0;
    const partial = await get(publicVideoKey, { Range: "bytes=0-3" });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("Content-Range"), `bytes 0-${IMAGE_BYTES.length - 1}/${IMAGE_BYTES.length}`);
    assert.equal(storageCalls[0].Range, "bytes=0-3");
    const malformed = await get(publicVideoKey, { Range: "bytes=5-2" });
    assert.equal(malformed.status, 416);
  } finally {
    storageMode = "ok";
  }
});

test("D5: malformed keys and other-owner shapes are 404 without storage reads", async (t) => {
  requirePg(t);
  session.userId = "";
  storageCalls.length = 0;
  assert.equal((await get("portfolio/not-a-key")).status, 404);
  assert.equal((await get(`portfolio/ffffffff-ffff-ffff-ffff-ffffffffffff/${"a".repeat(8)}.jpg`)).status, 404);
  assert.equal(storageCalls.length, 0);
});
