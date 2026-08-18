import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { checkServerIdentity } from "node:tls";
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

  test("the template gallery shows the owner's own work, not six gradients", async ({ page, context }) => {
    await context.addCookies([{ name: "rive_session", value: (await studioUser("templates")).token, url: baseUrl() }]);
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /Appearance/i }).click();
    await expect(page.locator("[data-portfolio-template]")).toHaveCount(6);

    /* The fixture's template renders live on arrival, with the fixture's own
       headline inside it — that is the difference between comparing and
       guessing. The others stay asleep until asked for. */
    const selected = page.locator('[data-portfolio-template="minimal-pro"]');
    await expect(selected).toContainText("Independent product designer", { timeout: 20_000 });

    const asleep = page.locator('[data-portfolio-template="creator"]');
    await expect(asleep).not.toContainText("Independent product designer");

    // Hovering wakes one, and it renders the same portfolio at its own template.
    await asleep.hover();
    await expect(asleep).toContainText("Independent product designer", { timeout: 20_000 });

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
});
