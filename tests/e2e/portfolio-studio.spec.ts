import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { crc32, deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

/**
 * The studio's job: get someone from an incomplete portfolio to a credible
 * published one without them having to work out the order themselves.
 *
 * These cover the parts of that journey that are easy to regress — the next
 * action being present and actually going somewhere, the work coming first,
 * seeing the result while editing, and configuration staying out of the way
 * until it applies.
 */

loadEnvConfig(process.cwd());

const dbChecksEnabled = Boolean(process.env.DATABASE_URL);
const sessionSecret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-development-session-secret";

type TestDb = { prisma: PrismaClient; pool: Pool };
let db: TestDb;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function tokenFor(user: { id: string; email: string; plan: string; sessionVersion: number }) {
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ userId: user.id, email: user.email, plan: user.plan, sessionVersion: user.sessionVersion, expiry });
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

function baseUrl() {
  return process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${process.env.PLAYWRIGHT_PORT || 3000}`;
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

/** A deliberately incomplete portfolio: a project with no cover, no testimonials. */
function studioContent() {
  return {
    name: "Studio Fixture",
    profileImageUrl: "",
    showProfileImage: false,
    headline: "Independent product designer",
    bio: "Fixture portfolio for studio tests.",
    location: "Remote",
    availability: "Open",
    contactEmail: "studio@example.invalid",
    social: [],
    practices: [],
    practiceLayout: "unified" as const,
    mediaSettings: { autoplayOnScroll: false, loop: false, hoverPreview: false, lightbox: true, layout: "grid" as const, fit: "cover" as const, showCaptions: true },
    projects: [
      { id: "needs-cover", title: "Harbour rebuild", description: "A project without a cover image.", role: "Design", year: "2026", url: "", imageUrl: "", visibility: "public" as const, media: [] },
    ],
    services: [{ id: "s1", title: "Product design", description: "End to end." }],
    testimonials: [],
    sections: [
      { key: "about" as const, visible: true }, { key: "projects" as const, visible: true },
      { key: "services" as const, visible: true }, { key: "testimonials" as const, visible: false },
      { key: "contact" as const, visible: true },
    ],
  };
}

function profilePhotoFixture() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
}

function pngChunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const payload = Buffer.concat([Buffer.from(type), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(payload) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}

/** A real large decoded image, compressed to a few kilobytes. 1×1 fixtures
 *  cannot catch intrinsic-size overflow after an upload. */
function largePhotoFixture(width = 1200, height = 1800) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3;
      raw[i] = 37;
      raw[i + 1] = 99;
      raw[i + 2] = 235;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function workspaceScrollState(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const shell = document.querySelector("[data-dashboard-shell]");
    const main = document.querySelector("main");
    const html = document.documentElement;
    return {
      documentScrollHeight: html.scrollHeight,
      documentClientHeight: html.clientHeight,
      documentScrollTop: html.scrollTop || document.body.scrollTop,
      bodyScrollHeight: document.body.scrollHeight,
      viewportHeight: window.innerHeight,
      shellTop: shell?.getBoundingClientRect().top ?? 0,
      shellHeight: shell?.getBoundingClientRect().height ?? 0,
      mainScrollHeight: main?.scrollHeight ?? 0,
      mainClientHeight: main?.clientHeight ?? 0,
    };
  });
}

/**
 * A preview that exists but has no room is not a preview.
 *
 * The pane height rides on `frameClassName`. When the frame became absolutely
 * positioned, the container's `flex-1` — `flex: 1 1 0%` — beat that height for
 * the item's main size in an auto-height column, and the whole preview
 * collapsed to a 20px strip. Every existing assertion still passed: the iframe
 * was present, correctly titled, and exactly one of it. Only its size was a lie.
 */
async function expectPreviewHasRoom(page: import("@playwright/test").Page) {
  const box = await page.locator('iframe[title$="portfolio preview"]').boundingBox();
  expect(box, "the preview frame must be laid out, not display:none").not.toBeNull();
  expect(
    box?.height ?? 0,
    `the live preview rendered ${Math.round(box?.height ?? 0)}px tall — it has collapsed`,
  ).toBeGreaterThan(300);
  expect(box?.width ?? 0).toBeGreaterThan(200);
}

async function studioUser(label: string) {
  const user = await db.prisma.user.create({
    data: {
      email: `studio-${label}-${randomUUID()}@rive.test`,
      name: `Studio ${label}`,
      passwordHash: hashPassword("studio-test-password"),
      plan: "pro",
      onboardingStatus: "complete",
      businessType: "freelancer",
      currency: "USD",
      timeZone: "UTC",
    },
    select: { id: true, email: true, plan: true, sessionVersion: true },
  });
  await db.prisma.portfolio.create({
    data: {
      userId: user.id,
      slug: `studio-${label}-${randomUUID().slice(0, 8)}`,
      status: "draft",
      templateKey: "minimal-pro",
      content: studioContent(),
      theme: { accent: "#2563EB", mode: "light", radius: "soft" },
      seo: { title: "", description: "", indexable: false },
    },
  });
  return { token: tokenFor(user), user };
}

/** A portfolio with nothing in it at all — the first-run case. Most accounts
 *  never see this, because provisioning prefills from the account's own record. */
async function unstartedStudioUser(label: string) {
  const user = await db.prisma.user.create({
    data: {
      email: `studio-${label}-${randomUUID()}@rive.test`,
      name: `Studio ${label}`,
      passwordHash: hashPassword("studio-test-password"),
      plan: "pro",
      onboardingStatus: "complete",
      businessType: "freelancer",
      currency: "USD",
      timeZone: "UTC",
    },
    select: { id: true, email: true, plan: true, sessionVersion: true },
  });
  await db.prisma.portfolio.create({
    data: {
      userId: user.id,
      slug: `studio-${label}-${randomUUID().slice(0, 8)}`,
      status: "draft",
      templateKey: "minimal-pro",
      content: {},
      theme: { accent: "#2563EB", mode: "light", radius: "soft" },
      seo: { title: "", description: "", indexable: false },
    },
  });
  return { token: tokenFor(user), user };
}

test.describe("portfolio studio", () => {
  test.skip(!dbChecksEnabled, "Requires DATABASE_URL with a migrated test database.");
  test.setTimeout(120_000);

  /* The feedback widget invites itself onto any dashboard page 4.5 seconds after
     load, as a full-screen modal that swallows clicks. Short tests finished
     before it appeared; this file's longest one did not, and failed on a click
     the modal intercepted rather than on anything it was testing. Stubbed to
     unavailable so studio tests measure the studio. */
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/feedback/prompt**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, available: false, prompt: null }) }),
    );
  });

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

  test("names the next action and takes you to it", async ({ page, context }) => {
    await context.addCookies([{ name: "rive_session", value: (await studioUser("worklist")).token, url: baseUrl() }]);
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    const publish = page.locator("[data-guide-target='portfolio-publish']");
    await expect(publish).toBeVisible();
    expect(
      await publish.evaluate((el) => getComputedStyle(el).backgroundColor),
      "Publish / Update live site must paint a button surface, not sit as plain text",
    ).not.toMatch(/^(transparent|rgba\(\s*0,\s*0,\s*0,\s*0\))$/);

    /* The fixture's one project has no cover, so that is the outstanding
       essential — and it must name the project rather than say "add a cover
       image", which is useless once there is more than one. */
    const nextAction = page.getByRole("button", { name: /Add a cover image to Harbour rebuild/i });
    await expect(nextAction).toBeVisible({ timeout: 20_000 });

    /* The studio opens on the work, not the profile form — asserted through the
       work panel's own copy, since the nav label alone appears twice. */
    const workPanel = page.getByText("Show the work you want clients to remember", { exact: false });
    await expect(workPanel).toBeVisible();

    // Somewhere else, then follow the action back: it must land on the work.
    await page.getByRole("button", { name: /Appearance/i }).click();
    await expect(workPanel).toBeHidden();

    await nextAction.click();
    await expect(workPanel).toBeVisible();
  });

  test("shows one preview, never two, and keeps it in step with edits", async ({ page, context }) => {
    await context.addCookies([{ name: "rive_session", value: (await studioUser("preview")).token, url: baseUrl() }]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    /* Below the side-by-side breakpoint the editor must not mount a preview at
       all: a second iframe would load the preview route twice on every visit
       and make any frame selector ambiguous. */
    await expect(page.locator('iframe[title$="portfolio preview"]')).toHaveCount(0);

    /* There is no Preview tab any more — with the preview beside the editor on a
       wide screen, a tab showing the same thing was the same thing twice. The
       action bar's Preview button is the one way in, and it has to work here,
       where there is no ambient pane at all. */
    await expect(page.getByRole("tab", { name: "Preview" })).toHaveCount(0);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByRole("dialog", { name: /full-screen portfolio preview/i })).toBeVisible();
    await expect(page.locator('iframe[title$="portfolio preview"]')).toHaveCount(1);

    // Switching device size keeps exactly one frame, retitled.
    await page.getByRole("button", { name: "Mobile preview" }).click();
    await expect(page.locator('iframe[title="mobile portfolio preview"]')).toHaveCount(1);
    await expect(page.locator('iframe[title$="portfolio preview"]')).toHaveCount(1);

    await expectPreviewHasRoom(page);

    /* Closing it takes the frame with it. A narrow studio that quietly kept a
       preview route mounted would be loading a page nobody can see. */
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /full-screen portfolio preview/i })).toBeHidden();
    await expect(page.locator('iframe[title$="portfolio preview"]')).toHaveCount(0);
  });

  test("side-by-side preview appears on a wide screen, and only there", async ({ page, context }) => {
    await context.addCookies([{ name: "rive_session", value: (await studioUser("wide")).token, url: baseUrl() }]);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    // Editing and seeing are on screen together, with a single frame.
    await expect(page.getByText("Live preview")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('iframe[title$="portfolio preview"]')).toHaveCount(1);
    await expectPreviewHasRoom(page);

    /* Desktop is the case that broke, and the one whose height depends on the
       scale: it renders at 1440px and is scaled into a 416px column. */
    const inlineWidth = (await page.locator('iframe[title$="portfolio preview"]').boundingBox())?.width ?? 0;
    await page.getByRole("button", { name: "Desktop preview" }).click();
    await expectPreviewHasRoom(page);

    /* Desktop in a 416px column renders at 27%, which is honest and unreadable,
       so choosing it promotes the preview to the overlay instead of shrinking
       it into the pane. */
    const overlay = page.getByRole("dialog", { name: /full-screen portfolio preview/i });
    await expect(overlay).toBeVisible();
    await expect(page.locator('iframe[title$="portfolio preview"]'), "the overlay must move the frame, not add one").toHaveCount(1);

    const inspectWidth = (await page.locator('iframe[title$="portfolio preview"]').boundingBox())?.width ?? 0;
    expect(inspectWidth, "desktop in the overlay must be materially bigger than desktop in the pane").toBeGreaterThan(inlineWidth * 1.5);

    /* Nothing may paint over the overlay. The first attempt kept the frame
       inside the studio's own stacking context, so the sticky app header, the
       publish bar and the feedback launcher all drew straight over a
       "full-screen" layer and buried the switcher and the Close button. Counting
       iframes and measuring the frame both passed while that was true — only
       hit-testing the controls catches it. */
    const covered = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label*="Full-screen"]');
      if (!dialog) return "no dialog";
      const targets = [dialog.querySelector("[data-portfolio-preview-inspect]"), dialog.querySelector('[role="group"][aria-label="Preview size"]')];
      for (const target of targets) {
        if (!target) return "control missing from the overlay";
        const box = target.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (!hit || !dialog.contains(hit)) return `${target.getAttribute("aria-label") || "control"} is covered by <${hit?.tagName.toLowerCase() ?? "nothing"} class="${hit?.className ?? ""}">`;
      }
      return "clear";
    });
    expect(covered).toBe("clear");

    // Dismissable by keyboard alone, with focus handed back to what opened it.
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
    await expect(page.locator('iframe[title$="portfolio preview"]')).toHaveCount(1);

    /* And the pane comes back showing something it can actually render. Desktop
       promotes to the overlay because 27% in this column cannot be judged, so
       returning to the column still on Desktop would restore exactly the
       rendering the overlay exists to avoid. */
    await expect(page.locator('iframe[title="mobile portfolio preview"]')).toHaveCount(1);
    await expect(page.getByText(/%\s*·\s*\d+px wide/)).toHaveCount(0);

    // Mobile is the ambient mode and stays inline — no overlay, no interruption.
    await page.getByRole("button", { name: "Mobile preview" }).click();
    await expect(overlay).toBeHidden();
    await expectPreviewHasRoom(page);

    // And the overlay is reachable deliberately, not only as a side effect.
    await page.locator("[data-portfolio-preview-inspect]").click();
    await expect(overlay).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, "the two-pane studio must not scroll the page sideways, including after the overlay closes").toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });

  test("playback settings stay hidden until a project has media", async ({ page, context }) => {
    await context.addCookies([{ name: "rive_session", value: (await studioUser("media")).token, url: baseUrl() }]);
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /Appearance/i }).click();
    await expect(page.getByText("Media playback")).toBeVisible();
    // The fixture has no media, so the seven toggles must not be here yet.
    await expect(page.getByText(/These settings appear once a project has images/i)).toBeVisible();
    await expect(page.getByText("Play video automatically as visitors scroll")).toHaveCount(0);
  });

  test("the studio still works on a phone", async ({ page, context }) => {
    await context.addCookies([{ name: "rive_session", value: (await studioUser("mobile")).token, url: baseUrl() }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole("button", { name: /Add a cover image to Harbour rebuild/i })).toBeVisible({ timeout: 20_000 });

    const overflow = async (what: string) => {
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(
        dimensions.scrollWidth,
        `${what} overflows by ${dimensions.scrollWidth - dimensions.clientWidth}px at 390px`,
      ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    };
    await overflow("the studio");

    /* The surfaces added since this test was written are the ones most likely to
       break a phone: a six-card gallery of scaled miniatures, and a modal. */
    await page.getByRole("button", { name: /Appearance/i }).click();
    await expect(page.locator("[data-portfolio-template]")).toHaveCount(6);
    await overflow("the template gallery");

    await page.getByRole("button", { name: /Publish portfolio/i }).click();
    const review = page.locator("[data-portfolio-publish-review]");
    await expect(review).toBeVisible();
    await overflow("the publish review");

    // It must fit the screen, not run off the bottom of it with the buttons.
    const fits = await review.evaluate((element) => element.getBoundingClientRect().height <= window.innerHeight + 1);
    expect(fits, "the publish review must fit a 844px-tall phone").toBe(true);

    await page.keyboard.press("Escape");
    await expect(review).toBeHidden();
  });

  test("profile photos can be cropped, opted into, and laid out publicly", async ({ page, context }) => {
    const { token, user } = await studioUser("profile-photo");
    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /^Profile/i }).click();
    const editor = page.locator("[data-profile-image-editor]");
    const displaySwitch = editor.getByRole("switch", { name: "Show profile photo on public portfolio" });
    await expect(displaySwitch).toBeDisabled();

    await editor.locator('input[type="file"]').setInputFiles({
      name: "profile.png",
      mimeType: "image/png",
      buffer: profilePhotoFixture(),
    });
    const cropDialog = page.getByRole("dialog", { name: /Adjust your profile photo/i });
    await expect(cropDialog).toBeVisible();
    await expect(cropDialog.locator("[data-profile-image-cropper]")).toBeVisible();
    const dialogLayout = await cropDialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const save = Array.from(element.querySelectorAll("button")).find((button) => button.textContent?.includes("Save crop"));
      const saveBounds = save?.getBoundingClientRect();
      return {
        dialogBottom: bounds.bottom,
        saveBottom: saveBounds?.bottom ?? Number.POSITIVE_INFINITY,
        viewportHeight: window.innerHeight,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    });
    expect(dialogLayout.dialogBottom).toBeLessThanOrEqual(dialogLayout.viewportHeight + 1);
    expect(dialogLayout.saveBottom).toBeLessThanOrEqual(dialogLayout.viewportHeight + 1);
    expect(dialogLayout.scrollHeight).toBeLessThanOrEqual(dialogLayout.clientHeight + 1);
    await page.getByRole("button", { name: "Rotate photo right" }).click();
    await expect(page.getByRole("button", { name: "Save crop" })).toBeEnabled();
    await page.getByRole("button", { name: "Save crop" }).click();
    await expect(cropDialog).toBeHidden({ timeout: 20_000 });
    await expect(displaySwitch).toBeEnabled();

    await expect.poll(async () => {
      const portfolio = await db.prisma.portfolio.findUnique({ where: { userId: user.id }, select: { content: true } });
      const content = portfolio?.content as { profileImageUrl?: unknown; profileImageSourceUrl?: unknown; showProfileImage?: unknown } | null;
      return {
        hasImage: typeof content?.profileImageUrl === "string" && content.profileImageUrl.startsWith("data:image/"),
        hasOriginal: typeof content?.profileImageSourceUrl === "string" && content.profileImageSourceUrl.startsWith("data:image/"),
        showProfileImage: content?.showProfileImage,
      };
    }, { timeout: 20_000 }).toEqual({ hasImage: true, hasOriginal: true, showProfileImage: false });

    const portfolio = await db.prisma.portfolio.findUnique({ where: { userId: user.id }, select: { slug: true } });
    expect(portfolio?.slug).toBeTruthy();
    await db.prisma.portfolio.update({ where: { userId: user.id }, data: { status: "published" } });
    await page.goto(`/p/${portfolio?.slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('img[alt$="profile"]')).toHaveCount(0);
    await expect(page.locator("main > section").first()).toHaveClass(/block/);

    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Profile/i }).click();
    await expect(displaySwitch).toBeEnabled();
    const savedContent = await db.prisma.portfolio.findUnique({ where: { userId: user.id }, select: { content: true } });
    const originalImageUrl = (savedContent?.content as { profileImageSourceUrl?: string } | null)?.profileImageSourceUrl;
    await page.getByRole("button", { name: "Edit crop" }).click();
    const recropSource = await page.getByRole("dialog", { name: /Adjust your profile photo/i }).locator('img[alt="Profile photo being edited"]').getAttribute("src");
    expect(recropSource).toBe(originalImageUrl);
    await page.getByRole("button", { name: "Cancel" }).click();
    await displaySwitch.click();
    await expect.poll(async () => {
      const saved = await db.prisma.portfolio.findUnique({ where: { userId: user.id }, select: { content: true } });
      return (saved?.content as { showProfileImage?: unknown } | null)?.showProfileImage;
    }, { timeout: 20_000 }).toBe(true);

    await page.goto(`/p/${portfolio?.slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('img[alt$="profile"]')).toBeVisible();
    await expect(page.locator("main > section").first()).toHaveClass(/grid/);
  });

  test("inline cover uploads stay compact and keep the studio rendered", async ({ page, context }) => {
    const { token } = await studioUser("inline-cover");
    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);
    await page.route("**/api/uploads/presign", async (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Inline upload fallback" }),
    }));
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    const project = page.locator("article").first();
    const coverInput = project.locator('input[type="file"]').first();
    await coverInput.setInputFiles({
      name: "cover.png",
      mimeType: "image/png",
      buffer: largePhotoFixture(),
    });

    await expect(page.getByText("image added", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(project.locator("[data-project-cover-preview]")).toBeVisible();
    await expect(project.getByText("Cover image ready", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible();
    await expect(page.locator("main")).toContainText("Selected work");

    const previewBox = await project.locator("[data-project-cover-preview] img").boundingBox();
    expect(previewBox?.height ?? 0, "the cover thumbnail must not use the photo's intrinsic height").toBeLessThan(80);

    const fileBoxes = await page.locator('input[type="file"]').evaluateAll((inputs) =>
      inputs.map((input) => {
        const box = input.getBoundingClientRect();
        return { height: box.height, width: box.width };
      }),
    );
    for (const box of fileBoxes) {
      expect(box.height).toBeLessThanOrEqual(2);
      expect(box.width).toBeLessThanOrEqual(2);
    }

    const before = await workspaceScrollState(page);
    expect(before.documentScrollHeight, "uploading media must not make the document taller than the viewport").toBeLessThanOrEqual(before.documentClientHeight + 1);
    expect(Math.abs(before.shellTop)).toBeLessThanOrEqual(1);
    expect(before.shellHeight).toBeLessThanOrEqual(before.viewportHeight + 1);

    await page.locator("main").evaluate((main) => {
      main.scrollTop = main.scrollHeight;
    });
    await page.locator("main").evaluate((main) => {
      main.scrollTop = 0;
    });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible();
    const after = await workspaceScrollState(page);
    expect(after.documentScrollTop, "scrolling after an upload must not move the document behind the shell").toBe(0);
    expect(Math.abs(after.shellTop), "scrolling up must not hide the workspace chrome").toBeLessThanOrEqual(1);
    expect(after.documentScrollHeight).toBeLessThanOrEqual(after.documentClientHeight + 1);
  });

  test("typed work survives leaving a section, and autosave never publishes", async ({ page, context }) => {
    const { token, user } = await studioUser("autosave");
    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    const title = page.getByPlaceholder("e.g. A calmer checkout for Acme");
    await expect(title).toBeVisible();
    await title.fill("Harbour rebuild, revised");

    await page.getByRole("button", { name: /Appearance/i }).click();
    await expect(page.getByText("Show the work you want clients to remember", { exact: false })).toHaveCount(0);

    await page.getByRole("button", { name: /Selected work/i }).click();
    await expect(page.getByPlaceholder("e.g. A calmer checkout for Acme")).toHaveValue("Harbour rebuild, revised");

    await expect.poll(async () => {
      const portfolio = await db.prisma.portfolio.findUnique({
        where: { userId: user.id },
        select: { status: true, content: true },
      });
      const content = portfolio?.content as { projects?: Array<{ title?: string }> } | null;
      return {
        status: portfolio?.status,
        title: content?.projects?.[0]?.title,
      };
    }, { timeout: 15_000 }).toEqual({
      status: "draft",
      title: "Harbour rebuild, revised",
    });
  });

  test("projects can be reordered by keyboard, and the new order is what persists", async ({ page, context }) => {
    const { token, user } = await studioUser("reorder");
    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    const titles = page.getByPlaceholder("e.g. A calmer checkout for Acme");
    await expect(titles).toHaveCount(1);

    /* Reorder controls are pointless with one project, so they are not rendered
       until there are two — which is also what makes the order meaningful. */
    await expect(page.getByRole("button", { name: /Move .* later/i })).toHaveCount(0);

    await page.getByRole("button", { name: "Add project" }).click();
    await expect(titles).toHaveCount(2);
    await titles.nth(1).fill("Second project");

    await expect(titles.nth(0)).toHaveValue("Harbour rebuild");
    await page.getByRole("button", { name: /Move Harbour rebuild later/i }).click();

    // The order visitors read in is the order on screen.
    await expect(titles.nth(0)).toHaveValue("Second project");
    await expect(titles.nth(1)).toHaveValue("Harbour rebuild");

    // The first project cannot move earlier, and the last cannot move later.
    await expect(page.getByRole("button", { name: /Move Second project earlier/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Move Harbour rebuild later/i })).toBeDisabled();

    await expect.poll(async () => {
      const portfolio = await db.prisma.portfolio.findUnique({ where: { userId: user.id }, select: { content: true } });
      const content = portfolio?.content as { projects?: Array<{ title?: string }> } | null;
      return (content?.projects || []).map((project) => project.title);
    }, { timeout: 15_000 }).toEqual(["Second project", "Harbour rebuild"]);
  });

  test("the full-screen preview hands focus somewhere real, and gives it back", async ({ page, context }) => {
    await context.addCookies([{ name: "rive_session", value: (await studioUser("focus")).token, url: baseUrl() }]);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Live preview")).toBeVisible({ timeout: 20_000 });

    /* Opened from the keyboard, because that is the path where losing focus
       actually strands someone. */
    const toggle = page.locator("[data-portfolio-preview-inspect]");
    await toggle.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: /full-screen portfolio preview/i });
    await expect(dialog).toBeVisible();

    /* The backdrop is a real <button>, so `button:not([disabled])` matched it and
       it was the first "focusable" thing in the layer — focus landed on
       aria-hidden content and the first Tab went nowhere. */
    const landed = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      const overlay = document.querySelector('[role="dialog"][aria-label*="Full-screen"]');
      return {
        insideOverlay: Boolean(active && overlay?.contains(active)),
        hidden: Boolean(active?.closest('[aria-hidden="true"]')),
        tabbable: (active?.tabIndex ?? -1) >= 0,
        label: active?.getAttribute("aria-label") || active?.textContent?.trim() || null,
      };
    });
    expect(landed.insideOverlay, "focus must move into the overlay").toBe(true);
    expect(landed.hidden, "focus must not land on the aria-hidden backdrop").toBe(false);
    expect(landed.tabbable, "focus must land on something actually tabbable").toBe(true);
    expect(landed.label, "the focused control must have an accessible name").not.toBeNull();

    // Tab must stay inside the layer rather than escaping into the editor behind it.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => {
      const overlay = document.querySelector('[role="dialog"][aria-label*="Full-screen"]');
      return Boolean(overlay?.contains(document.activeElement));
    }), "Tab must not escape the overlay").toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    /* And focus comes back. The generic "restore to whatever opened it" cannot
       work here — that control lives in the subtree the overlay carries into the
       portal, so the original element no longer exists by the time it closes. */
    expect(await page.evaluate(() => document.activeElement?.hasAttribute("data-portfolio-preview-inspect") ?? false),
      "closing must return focus to the toggle, not drop it on <body>").toBe(true);
  });

  test("the feedback prompt does not invite itself into the studio", async ({ page, context }) => {
    await context.addCookies([{ name: "rive_session", value: (await studioUser("nointerrupt")).token, url: baseUrl() }]);

    /* The stub in beforeEach makes the prompt unavailable, which would hide a
       regression here. Make it available, and count whether it is even asked. */
    let promptRequests = 0;
    await page.route("**/api/feedback/prompt**", (route) => {
      if (route.request().method() === "GET") promptRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, available: true, prompt: { key: "workspace_general", type: "workspace" } }),
      });
    });

    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    /* It fires 4.5s after load as a full-screen layer that swallows clicks, so
       it could land over the preview mid-inspection and take the click meant for
       the control underneath. */
    await page.waitForTimeout(8_000);

    expect(promptRequests, "the studio must not even ask whether to interrupt").toBe(0);
    await expect(page.getByRole("heading", { name: "How is this feeling so far?" })).toHaveCount(0);

    // The button still works — this suppresses the interruption, not the feature.
    await page.getByRole("button", { name: /Share feedback/i }).click();
    await expect(page.getByRole("heading", { name: /How is this feeling so far\?|that is today's note/i })).toBeVisible();
  });

  test("publishing asks first, names what is missing, and only then goes live", async ({ page, context }) => {
    const { token, user } = await studioUser("publish");
    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /Publish portfolio/i }).click();

    const review = page.locator("[data-portfolio-publish-review]");
    await expect(review).toBeVisible();
    // What is about to become public, in the owner's own numbers.
    await expect(review).toContainText(/1 project/i);
    // The fixture's only project has no cover, so the review must say so.
    await expect(review).toContainText(/Add a cover image to Harbour rebuild/i);

    /* Opening the review must not publish. The whole point is that the first
       click stopped being the irreversible one. */
    await expect.poll(async () => {
      const portfolio = await db.prisma.portfolio.findUnique({ where: { userId: user.id }, select: { status: true } });
      return portfolio?.status;
    }, { timeout: 5_000 }).toBe("draft");

    // Escape backs out without publishing, like any other overlay here.
    await page.keyboard.press("Escape");
    await expect(review).toBeHidden();

    await page.getByRole("button", { name: /Publish portfolio/i }).click();
    await expect(review).toBeVisible();
    await page.locator("[data-portfolio-publish-confirm]").click();

    await expect.poll(async () => {
      const portfolio = await db.prisma.portfolio.findUnique({ where: { userId: user.id }, select: { status: true } });
      return portfolio?.status;
    }, { timeout: 15_000 }).toBe("published");
  });

  test("a publish confirmed mid-save waits for the real outcome", async ({ page, context }) => {
    const { token, user } = await studioUser("queued-publish");
    /* Publish validation must fail: the queued publish replays against this
       content, and only a real failure proves the dialog waited for it. */
    await db.prisma.portfolio.update({
      where: { userId: user.id },
      data: { content: { ...studioContent(), headline: "" } },
    });
    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);

    /* Hold the first PATCH open so the autosave below is still in flight when
       the publish is confirmed. Later PATCHes pass straight through. The kinds
       log records the order they went out, which proves the window was real —
       it says nothing about how the dialog behaved. What catches an optimistic
       `return true` is the review still being open further down. */
    const patchKinds: string[] = [];
    let releaseAutosave: () => void = () => undefined;
    const autosaveGate = new Promise<void>((resolve) => {
      releaseAutosave = resolve;
    });
    let patchHeld = false;
    await page.route("**/api/portfolio", async (route) => {
      const request = route.request();
      if (request.method() !== "PATCH") return route.continue();
      try {
        patchKinds.push(String(request.postDataJSON()?.status ?? "autosave"));
      } catch {
        patchKinds.push("autosave");
      }
      if (!patchHeld) {
        patchHeld = true;
        /* The flight cannot complete until the test releases it after the
           confirm click, so the publish provably queues behind it. The
           timeout is a backstop against hanging the suite, not the window. */
        await Promise.race([autosaveGate, page.waitForTimeout(30_000)]);
      }
      await route.continue();
    });

    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /^Profile/i }).click();
    await expect(page.getByRole("heading", { name: "Basic profile" })).toBeVisible();
    const bio = page.getByPlaceholder(/Tell people what you do, who you help/i);
    await expect(bio).toBeVisible();
    const patchSent = page.waitForRequest(
      (request) => request.url().includes("/api/portfolio") && request.method() === "PATCH",
    );
    await bio.pressSequentially(" Still iterating on the framing.");
    /* The request is sent — and therefore in flight — while the interception
       above holds it. The publish confirm below lands inside that window. */
    await patchSent;
    await expect(page.getByText("Saving…")).toBeVisible();

    /* Publish used to be disabled while saving. Base UI's click handler still
       sees the React `disabled` prop after stripping the DOM attribute, so a
       native click never opened the review. Opening the review is not a save,
       so the toolbar stays enabled and this is a real click. */
    await page.locator("[data-guide-target='portfolio-publish']").click();
    const review = page.locator("[data-portfolio-publish-review]");
    await expect(review).toBeVisible();

    /* Confirm stays enabled during autosave (publishing is confirm-in-flight,
       not any save). Clicking it now is the path the persist queue exists for. */
    const confirm = review.locator("[data-portfolio-publish-confirm]");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(confirm).toContainText(/Publishing/);

    releaseAutosave();

    /* The queued publish replays after the held autosave lands and fails
       validation — the dialog must stay open showing why, not close on an
       optimistic yes. */
    await expect(review).toContainText(/Add a headline before publishing\./, { timeout: 20_000 });
    await expect(review).toBeVisible();
    await expect.poll(async () => {
      const portfolio = await db.prisma.portfolio.findUnique({ where: { userId: user.id }, select: { status: true } });
      return portfolio?.status;
    }, { timeout: 10_000 }).toBe("draft");

    /* Order, not outcome. The publish went out after the held autosave, so it
       queued rather than racing it. The old optimistic `return true` queued the
       replay too, so this sequence was identical under it — this assertion
       cannot catch that regression on its own. The review assertions above are
       what fail when the dialog closes on a publish that never happened. */
    expect(patchKinds, "the publish must queue behind the autosave").toEqual(["autosave", "published"]);
  });

  test("the template gallery shows the owner's own work, not six gradients", async ({ page, context }) => {
    await context.addCookies([{ name: "rive_session", value: (await studioUser("templates")).token, url: baseUrl() }]);
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /Appearance/i }).click();
    await expect(page.locator("[data-portfolio-template]")).toHaveCount(6);

    /* Every template renders live on arrival, with the fixture's own headline
       inside it — that is the difference between comparing and guessing. */
    for (const template of ["minimal-pro", "visual-studio", "digital-builder", "expert-profile", "creator", "agency"]) {
      await expect(page.locator(`[data-portfolio-template="${template}"]`)).toContainText("Independent product designer", { timeout: 20_000 });
    }

    /* A miniature is an entire portfolio. `aria-hidden` and `pointer-events-none`
       hide it from assistive technology and the mouse but leave every link and
       field in the tab order, so without `inert` the keyboard walks into six
       hidden copies of the owner's nav and contact form.

       This asks the browser rather than reasoning about attributes. The first
       version of this check read `element.inert` on each descendant and found 26
       "reachable" nodes — because the `inert` IDL property reflects the
       attribute only on the element that carries it, never on the subtree it
       disables. Trying to take focus is the question actually worth asking. */
    const focusReport = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("[data-portfolio-template]")];
      let miniatures = 0;
      let tookFocus = 0;
      for (const card of cards) {
        const decorative = card.querySelector("[inert]");
        if (!decorative) continue;
        miniatures += 1;
        for (const element of decorative.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea")) {
          element.focus();
          if (document.activeElement === element) tookFocus += 1;
        }
      }
      (document.activeElement as HTMLElement | null)?.blur?.();
      return { miniatures, tookFocus };
    });

    expect(focusReport.miniatures, "the live miniature must be wrapped in an inert container").toBeGreaterThan(0);
    expect(focusReport.tookFocus, "nothing inside a template miniature may take keyboard focus").toBe(0);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, "scaled miniatures must not push the page sideways").toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });

  test("an empty portfolio gets an ordered path, and a started one does not", async ({ page, context }) => {
    await context.addCookies([{ name: "rive_session", value: (await unstartedStudioUser("firstrun")).token, url: baseUrl() }]);
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    const firstRun = page.locator("[data-portfolio-first-run]");
    await expect(firstRun).toBeVisible({ timeout: 20_000 });
    await expect(firstRun).toContainText(/Say who you are/i);

    /* One guidance surface, not two: the worklist is replaced rather than
       stacked on top of. */
    await expect(page.getByText(/of 9 done/i)).toHaveCount(0);

    // A step goes where it says it goes.
    await firstRun.getByRole("button", { name: /Add a project/i }).click();
    await expect(page.getByText("Show the work you want clients to remember", { exact: false })).toBeVisible();

    /* Typing a name is enough to count as started, and the path steps aside for
       the worklist without needing a reload. */
    await page.getByRole("button", { name: /^Profile/i }).click();
    await page.getByPlaceholder("Your name").fill("Arnav");
    await expect(firstRun).toBeHidden();
  });

  test("a stale revision asks the owner to choose instead of overwriting their draft", async ({ page, context }) => {
    const { token, user } = await studioUser("conflict");
    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    await db.prisma.portfolio.update({
      where: { userId: user.id },
      data: { revision: { increment: 1 } },
    });

    await page.getByPlaceholder("e.g. A calmer checkout for Acme").fill("Kept local harbour");

    /* Scoped to the studio's own banner rather than role=alert: Next renders an
       always-present, empty route announcer with that role, so the bare role
       selector matches two elements and resolves to neither. */
    await expect(page.locator("[data-portfolio-save-alert]")).toContainText(/changed elsewhere/i, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Keep my draft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload latest" })).toBeVisible();

    // The whole point of the prompt: the owner's text is still on screen.
    await expect(page.getByPlaceholder("e.g. A calmer checkout for Acme")).toHaveValue("Kept local harbour");
  });

  test("accent colour changes apply in the studio and persist", async ({ page, context }) => {
    const { token, user } = await studioUser("accent");
    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Live preview")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /Appearance/i }).click();
    const picker = page.locator("[data-accent-picker]");
    await expect(picker).toBeVisible();

    const well = await picker.locator('input[type="color"]').boundingBox();
    expect(well?.width ?? 0, "the accent well must be a real click target, not a padded sliver").toBeGreaterThanOrEqual(40);
    expect(well?.height ?? 0).toBeGreaterThanOrEqual(40);

    await picker.getByRole("button", { name: "Use #DB2777" }).click();
    await expect(picker.locator("[data-accent-sample]")).toHaveCSS("background-color", "rgb(219, 39, 119)");
    await expect.poll(async () => (await picker.locator('input[type="color"]').inputValue()).toLowerCase()).toBe("#db2777");
    await expect(picker.getByLabel("Accent hex value")).toHaveValue("#DB2777");

    await expect.poll(async () => {
      const accent = await page.locator('iframe[title$="portfolio preview"]').evaluate((frame) => {
        const doc = (frame as HTMLIFrameElement).contentDocument;
        const root = doc?.querySelector("[style*='--portfolio-accent']") as HTMLElement | null;
        return root ? getComputedStyle(root).getPropertyValue("--portfolio-accent").trim() : "";
      });
      return accent.toUpperCase();
    }, { timeout: 15_000 }).toBe("#DB2777");

    await expect.poll(async () => {
      const portfolio = await db.prisma.portfolio.findUnique({ where: { userId: user.id }, select: { theme: true } });
      const theme = portfolio?.theme as { accent?: string } | null;
      return theme?.accent?.toUpperCase();
    }, { timeout: 15_000 }).toBe("#DB2777");
  });

  test("live preview switches practices when they open on separate pages", async ({ page, context }) => {
    const { token, user } = await studioUser("separate-preview");
    const content = studioContent();
    await db.prisma.portfolio.update({
      where: { userId: user.id },
      data: {
        content: {
          ...content,
          headline: "I make things for a living",
          practiceLayout: "separate",
          practices: [
            { id: "prac-bake", slug: "baking", name: "Baking", tagline: "Sourdough, every morning", description: "Bread and pastry.", order: 0, visibility: "public" },
            { id: "prac-music", slug: "music", name: "Music", tagline: "Songs that hold still", description: "Records and sessions.", order: 1, visibility: "public" },
          ],
          projects: [
            { ...content.projects[0], id: "p-bake", title: "Harbour loaf", practiceId: "prac-bake" },
            { id: "p-music", title: "Studio album", description: "A record.", role: "Producer", year: "2026", url: "", imageUrl: "", visibility: "public", media: [], practiceId: "prac-music" },
          ],
        },
      },
    });
    await context.addCookies([{ name: "rive_session", value: token, url: baseUrl() }]);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Live preview")).toBeVisible({ timeout: 20_000 });

    const frame = page.frameLocator('iframe[title$="portfolio preview"]');
    const practices = frame.getByRole("navigation", { name: "Practices" });
    await expect(practices.getByRole("button", { name: "Baking" })).toBeVisible({ timeout: 20_000 });
    await expect(frame.getByRole("heading", { level: 1 })).toHaveText("I make things for a living");

    await practices.getByRole("button", { name: "Baking" }).click();
    await expect(frame.getByRole("heading", { level: 1 })).toHaveText("Sourdough, every morning");
    await expect(practices.getByRole("button", { name: "Baking" })).toHaveAttribute("aria-pressed", "true");
    await expect(frame.getByText("Harbour loaf")).toBeVisible();
    await expect(frame.getByText("Studio album")).toHaveCount(0);

    await practices.getByRole("button", { name: "Music" }).click();
    await expect(frame.getByRole("heading", { level: 1 })).toHaveText("Songs that hold still");
    await expect(frame.getByText("Studio album")).toBeVisible();
    await expect(frame.getByText("Harbour loaf")).toHaveCount(0);

    await practices.getByRole("button", { name: "Everything" }).click();
    await expect(frame.getByRole("heading", { level: 1 })).toHaveText("I make things for a living");
    await expect(frame.getByText("Harbour loaf")).toBeVisible();
    await expect(frame.getByText("Studio album")).toBeVisible();
  });
});

test.describe("portfolio live preview practices", () => {
  test("switching separate-page practices updates the preview in place", async ({ page }) => {
    await page.goto("/portfolio-preview", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Loading portfolio preview…")).toBeHidden({ timeout: 20_000 });

    await page.evaluate(() => {
      window.postMessage({
        type: "rive:portfolio-preview",
        payload: {
          templateKey: "minimal-pro",
          theme: { accent: "#2563EB", mode: "light", radius: "soft" },
          content: {
            name: "Maya Rao",
            headline: "I make things for a living",
            bio: "Two disciplines, one site.",
            practiceLayout: "separate",
            practices: [
              { id: "prac-bake", slug: "baking", name: "Baking", tagline: "Sourdough, every morning", description: "", order: 0, visibility: "public" },
              { id: "prac-music", slug: "music", name: "Music", tagline: "Songs that hold still", description: "", order: 1, visibility: "public" },
            ],
            projects: [
              { id: "p-bake", title: "Harbour loaf", visibility: "public", practiceId: "prac-bake" },
              { id: "p-music", title: "Studio album", visibility: "public", practiceId: "prac-music" },
            ],
            services: [],
            testimonials: [],
            sections: [
              { key: "about", visible: true },
              { key: "projects", visible: true },
              { key: "services", visible: true },
              { key: "testimonials", visible: false },
              { key: "contact", visible: true },
            ],
          },
        },
      }, window.location.origin);
    });

    const practices = page.getByRole("navigation", { name: "Practices" });
    await expect(practices.getByRole("button", { name: "Baking" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("I make things for a living");

    await practices.getByRole("button", { name: "Baking" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sourdough, every morning");
    await expect(practices.getByRole("button", { name: "Baking" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Harbour loaf")).toBeVisible();
    await expect(page.getByText("Studio album")).toHaveCount(0);

    await practices.getByRole("button", { name: "Music" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Songs that hold still");
    await expect(page.getByText("Studio album")).toBeVisible();
    await expect(page.getByText("Harbour loaf")).toHaveCount(0);

    await practices.getByRole("button", { name: "Everything" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("I make things for a living");
    await expect(page.getByText("Harbour loaf")).toBeVisible();
    await expect(page.getByText("Studio album")).toBeVisible();
  });
});
