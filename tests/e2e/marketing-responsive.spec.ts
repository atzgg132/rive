import { expect, test } from "@playwright/test";

const routes = ["/", "/product/clients-projects", "/product/agreements-invoices", "/product/portfolio", "/pricing", "/migrate-to-rive", "/about", "/changelog", "/contact", "/cookies", "/privacy", "/roadmap", "/terms", "/login", "/register"] as const;

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
  test(`marketing routes avoid horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: "load" });
      expect(response?.status(), route).toBeLessThan(400);
      const geometry = await page.evaluate(() => ({ client: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      expect(Math.max(geometry.document, geometry.body), route).toBeLessThanOrEqual(geometry.client + 1);
    }
  });
}

test("mobile hero preserves message, line integrity, and CTA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "load" });
  const hero = page.getByTestId("marketing-hero");
  await expect(hero.getByRole("heading", { name: /one record/i })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Start free", exact: true })).toBeVisible();
  const wrapped = await hero.locator(".inst-titlepage__line").evaluateAll((nodes) =>
    nodes.filter((n) => n.getBoundingClientRect().height > parseFloat(getComputedStyle(n).lineHeight) * 1.6).length,
  );
  expect(wrapped).toBe(0);
});

test("mobile navigation keeps account actions and product routes available", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "load" });
  const header = page.getByTestId("site-header");
  const menu = header.getByRole("button", { name: "Open navigation" });
  const box = await menu.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await menu.click();
  const nav = header.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav.getByRole("link", { name: "Clients & projects" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Log in", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Start free", exact: true })).toBeVisible();
});

test("product register and portfolio publication stack on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "load" });
  const funds = page.getByText(/does not collect or transfer funds/i).first();
  await funds.scrollIntoViewIfNeeded();
  await expect(funds).toBeVisible();
  await page.getByTestId("portfolio-showcase").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("portfolio-showcase")).toBeVisible();
});

test("focused signup remains usable with the mobile keyboard viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/register", { waitUntil: "load" });
  await expect(page.getByRole("dialog")).toBeVisible();
  const form = page.getByTestId("register-form");
  await expect(form).toBeVisible();
  await expect(form.locator("input[name='email']")).toBeEditable();
  await form.locator("input[name='password']").scrollIntoViewIfNeeded();
  await expect(form.getByRole("button", { name: "Create free account" })).toBeVisible();
});

test("hero headline is not clipped on a scaled 1080p laptop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/", { waitUntil: "load" });
  const hero = page.getByTestId("marketing-hero");
  const heading = hero.getByRole("heading", { name: /one record/i });
  await expect(heading).toBeVisible();
  const box = await heading.boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(0);
  const firstLine = heading.locator("span").first();
  await expect(firstLine).toBeVisible();
  const firstBox = await firstLine.boundingBox();
  expect(firstBox?.y).toBeGreaterThanOrEqual(0);
  await expect(hero.getByRole("link", { name: "Start free", exact: true })).toBeVisible();
});
