import { expect, test, type Page, type Route } from "@playwright/test";

const marketingRoutes = [
  "/",
  "/about",
  "/api-reference",
  "/blog",
  "/careers",
  "/changelog",
  "/community",
  "/contact",
  "/cookies",
  "/docs",
  "/guides",
  "/press",
  "/privacy",
  "/roadmap",
  "/terms",
] as const;

async function installMarketingMocks(page: Page) {
  await page.route("**/api/rates", async (route: Route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data: { base: "USD", date: "2026-08-10", rates: { USD: 1, INR: 83, EUR: 0.9 } } }),
  }));
}

test.describe("marketing responsive guardrails", () => {
  test("Remit keeps its story and calculator side by side on desktop", async ({ page }) => {
    await installMarketingMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#remit-transfers", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("remit-next-section")).toBeVisible();

    const geometry = await page.evaluate(() => {
      const story = document.querySelector<HTMLElement>('[data-testid="remit-next-story"]')?.getBoundingClientRect();
      const calculator = document.querySelector<HTMLElement>('[data-testid="remit-preview"]')?.getBoundingClientRect();
      return story && calculator
        ? { storyLeft: story.left, storyTop: story.top, storyBottom: story.bottom, storyWidth: story.width, calculatorLeft: calculator.left, calculatorTop: calculator.top, calculatorBottom: calculator.bottom, calculatorWidth: calculator.width, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), clientWidth: document.documentElement.clientWidth }
        : null;
    });

    expect(geometry).not.toBeNull();
    expect(geometry!.calculatorLeft).toBeGreaterThan(geometry!.storyLeft + geometry!.storyWidth / 2);
    expect(geometry!.calculatorTop).toBeLessThan(geometry!.storyBottom);
    expect(geometry!.storyTop).toBeLessThan(geometry!.calculatorBottom);
    expect(geometry!.calculatorWidth).toBeGreaterThan(400);
    expect(geometry!.scrollWidth).toBeLessThanOrEqual(geometry!.clientWidth + 1);
  });

  test("Remit stacks without overflow on mobile", async ({ page }) => {
    await installMarketingMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#remit-transfers", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("remit-next-section")).toBeVisible();
    await expect(page.getByTestId("remit-next-section").locator("dt")).toHaveCount(3);

    const geometry = await page.evaluate(() => {
      const story = document.querySelector<HTMLElement>('[data-testid="remit-next-story"]')?.getBoundingClientRect();
      const calculator = document.querySelector<HTMLElement>('[data-testid="remit-preview"]')?.getBoundingClientRect();
      return story && calculator
        ? { storyBottom: story.bottom, calculatorTop: calculator.top, calculatorWidth: calculator.width, clientWidth: document.documentElement.clientWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) }
        : null;
    });

    expect(geometry).not.toBeNull();
    expect(geometry!.calculatorTop).toBeGreaterThanOrEqual(geometry!.storyBottom);
    expect(geometry!.calculatorWidth).toBeLessThanOrEqual(geometry!.clientWidth - 32);
    expect(geometry!.scrollWidth).toBeLessThanOrEqual(geometry!.clientWidth + 1);
  });

  test("marketing keeps the complete product structure", async ({ page }) => {
    await installMarketingMocks(page);
    await page.goto("/#faq", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#agreement-context")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Scope stops living in the scrollback." })).toBeVisible();
    await expect(page.getByTestId("faq-grid").locator("h3")).toHaveCount(6);
    await expect(page.getByRole("heading", { name: "Can I bring my existing data into Rive?" })).toBeVisible();
  });

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    test(`every marketing route avoids horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const route of marketingRoutes) {
        const response = await page.goto(route, { waitUntil: "domcontentloaded" });
        expect(response?.status(), `${route} returned an error document`).toBeLessThan(400);
        await expect(page.locator("h1")).toHaveCount(1);
        const geometry = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
        }));
        expect(
          Math.max(geometry.documentWidth, geometry.bodyWidth),
          `${route} overflowed at ${viewport.width}px`,
        ).toBeLessThanOrEqual(geometry.clientWidth + 1);
      }
    });
  }

  test("AGREEMENT stays untruncated on a 320px first screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/", { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);

    const agreement = page.locator('[data-hero-stage-label="AGREEMENT"]');
    await expect(agreement).toBeVisible();
    await expect(agreement).toHaveText("AGREEMENT");

    const box = await agreement.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        overflow: style.textOverflow,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
      };
    });
    expect(box.overflow, "AGREEMENT should wrap instead of ellipsizing").not.toBe("ellipsis");
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);
  });

  test("mobile drawer keeps Log in and signup in view without scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "load" });

    const header = page.getByTestId("site-header");
    const menu = header.getByRole("button", { name: "Open navigation" });
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox?.width, "hamburger width").toBeGreaterThanOrEqual(44);
    expect(menuBox?.height, "hamburger height").toBeGreaterThanOrEqual(44);

    await menu.click();
    const nav = header.getByRole("navigation", { name: "Mobile navigation" });
    const login = nav.getByRole("link", { name: "Log in", exact: true });
    const signup = nav.getByRole("link", { name: "Build your workspace", exact: true });
    await expect(login).toBeVisible();
    await expect(signup).toBeVisible();

    const visibility = await page.evaluate(() => {
      const drawer = document.querySelector('[aria-label="Mobile navigation"]');
      if (!drawer) return null;
      const links = Array.from(drawer.querySelectorAll("a"));
      const loginLink = links.find((node) => node.textContent?.trim().startsWith("Log in"));
      const signupLink = links.find((node) => node.textContent?.includes("Build your workspace"));
      if (!loginLink || !signupLink) return null;
      const drawerRect = drawer.getBoundingClientRect();
      const inDrawerView = (node: Element) => {
        const rect = node.getBoundingClientRect();
        return rect.top >= drawerRect.top - 1
          && rect.bottom <= Math.min(drawerRect.bottom, window.innerHeight) + 1
          && rect.top >= 0
          && rect.bottom <= window.innerHeight + 1;
      };
      return { login: inDrawerView(loginLink), signup: inDrawerView(signupLink) };
    });

    expect(visibility).not.toBeNull();
    expect(visibility!.login, "Log in was below the drawer fold").toBe(true);
    expect(visibility!.signup, "signup was below the drawer fold").toBe(true);
  });

  test("hash targets land below the fixed header", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#agreement-context", { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);

    const nativeHash = await page.evaluate(() => {
      const header = document.querySelector("[data-testid='site-header']");
      const article = document.getElementById("agreement-context");
      const eyebrow = article?.querySelector("p");
      if (!header || !article || !eyebrow) return null;
      const headerBottom = header.getBoundingClientRect().bottom;
      return {
        headerBottom,
        articleTop: article.getBoundingClientRect().top,
        eyebrowTop: eyebrow.getBoundingClientRect().top,
      };
    });
    expect(nativeHash).not.toBeNull();
    expect(nativeHash!.articleTop, "chapter article sat under the header").toBeGreaterThanOrEqual(nativeHash!.headerBottom - 8);
    expect(nativeHash!.eyebrowTop, "chapter eyebrow sat under the header").toBeGreaterThanOrEqual(nativeHash!.headerBottom - 1);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await page.getByRole("link", { name: "See the unpaid role", exact: true }).click();
    await expect.poll(async () => page.evaluate(() => {
      const header = document.querySelector("[data-testid='site-header']");
      const problemNode = document.querySelector("[data-testid='marketing-problem']");
      const eyebrow = problemNode?.querySelector("p");
      if (!header || !problemNode || !eyebrow) return 999;
      return eyebrow.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
    })).toBeGreaterThanOrEqual(-1);
  });
});
