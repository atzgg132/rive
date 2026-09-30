import { expect, test, type Page } from "@playwright/test";

/* The v2 marketing site ships behind MARKETING_SITE_V2, a build-time switch.
   The regular shards build with it off (production parity); the `site v2`
   CI job builds with it on and runs only this file. */
const V2 = process.env.MARKETING_SITE_V2 === "1";

const V2_ROUTES = ["/", "/product/clients-projects", "/product/agreements-invoices", "/product/portfolio", "/migrate-to-rive", "/pricing", "/about", "/changelog", "/roadmap", "/contact", "/privacy", "/terms", "/cookies"];

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error" && !/api\/track|Failed to load resource/.test(message.text())) errors.push(message.text());
  });
  return errors;
}

test.describe("marketing site switch off", () => {
  test.skip(V2, "Runs against the production-parity build only.");

  test("the current site renders and no v2 markup ships", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByTestId("marketing-hero")).toBeVisible();
    await expect(page.locator('[data-site="v2"]')).toHaveCount(0);
  });
});

test.describe("marketing site v2", () => {
  test.skip(!V2, "Needs a build with MARKETING_SITE_V2=1.");

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    test(`the first screen says what, who, cost and the action at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      // The hero must stand on its own before any animation code arrives.
      await page.route(/gsap/, (route) => route.abort());
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const hero = page.locator("[data-hero]");
      await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(hero.getByRole("heading", { level: 1 })).toHaveAccessibleName(/From first enquiry to final invoice\./);
      await expect(hero.getByText(/freelancers/i).first()).toBeInViewport();
      await expect(hero.getByRole("link", { name: "Start free", exact: true })).toBeInViewport();
      await expect(hero.getByText("Free during beta. No credit card required.")).toBeInViewport();
      await expect(page).toHaveTitle(/workspace for freelancers/i);
    });
  }

  test("every signup link reads Start free and Remit never appears", async ({ page }) => {
    for (const route of V2_ROUTES) {
      await page.goto(route, { waitUntil: "load" });
      const labels = await page.locator('a[href^="/register"]').evaluateAll((links) => links.map((link) => (link.textContent || "").trim()));
      for (const label of labels) expect(label, `${route} signup link`).toBe("Start free");
      await expect(page.locator("body")).not.toContainText(/remit/i);
    }
  });

  test("Start free opens the signup overlay and records its placement", async ({ page }) => {
    const placements: string[] = [];
    await page.route("**/api/track/cta", async (route) => {
      placements.push((route.request().postDataJSON() as { placement?: string }).placement || "");
      await route.fulfill({ status: 200, contentType: "application/json", body: "{\"success\":true}" });
    });
    await page.goto("/", { waitUntil: "load" });
    await page.locator("[data-hero]").getByRole("link", { name: "Start free", exact: true }).click();
    await expect(page).toHaveURL(/\?auth=register/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("register-form")).toBeVisible();
    await expect.poll(() => placements).toContain("hero");
  });

  test("reduced motion shows every homepage section's content", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    const headings = page.locator("main h2");
    const count = await headings.count();
    expect(count).toBeGreaterThanOrEqual(9);
    for (let index = 0; index < count; index++) {
      const heading = headings.nth(index);
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
      await expect.poll(() => heading.evaluate((node) => Number(getComputedStyle(node).opacity))).toBeGreaterThan(0.9);
    }
    await expect(page.locator(".pin-spacer")).toHaveCount(0);
  });

  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/", "/product/agreements-invoices", "/pricing"]) {
        await page.goto(route, { waitUntil: "load" });
        const steps = 8;
        for (let step = 0; step <= steps; step++) {
          await page.evaluate((fraction) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * fraction), step / steps);
          await page.waitForTimeout(120);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, `${route} at ${width}px, step ${step}`).toBeLessThanOrEqual(1);
        }
      }
    });
  }

  test("marketing routes render without runtime errors", async ({ page }) => {
    const errors = await collectErrors(page);
    for (const route of V2_ROUTES) {
      await page.goto(route, { waitUntil: "load" });
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    }
    expect(errors).toEqual([]);
  });

  test("keyboard focus moves from the nav to the footer without getting stuck", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });
    let reachedFooter = false;
    let lastKey = "";
    let repeats = 0;
    for (let press = 0; press < 160 && !reachedFooter; press++) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active) return { key: "", inFooter: false, visible: false };
        const rect = active.getBoundingClientRect();
        return {
          key: `${active.tagName}:${active.textContent?.trim().slice(0, 40)}:${rect.top.toFixed(0)}`,
          inFooter: Boolean(active.closest("footer")),
          visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight,
        };
      });
      repeats = state.key === lastKey ? repeats + 1 : 0;
      lastKey = state.key;
      expect(repeats, "focus is stuck").toBeLessThan(3);
      expect(state.visible, `focused element is visible: ${state.key}`).toBe(true);
      reachedFooter = state.inFooter;
    }
    expect(reachedFooter).toBe(true);
  });

  test("Pause motion persists across a reload", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const toggle = page.getByRole("button", { name: /pause motion/i }).first();
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-motion-paused", "");
    await page.reload({ waitUntil: "load" });
    await expect(page.locator("html")).toHaveAttribute("data-motion-paused", "");
  });
});
