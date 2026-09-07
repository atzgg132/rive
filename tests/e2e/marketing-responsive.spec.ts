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

test("mobile hero preserves message, product glimpse, and CTA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "load" });
  const hero = page.getByTestId("marketing-hero");
  await expect(hero.getByRole("heading", { name: /Multiple clients. One clear picture./i })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Start free", exact: true })).toBeVisible();
  await expect(hero.getByTestId("hero-client-stage")).toBeVisible();
  const size = await hero.locator("h1").evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(size).toBeGreaterThanOrEqual(48);
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

test("product questions and portfolio publication stack on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#product", { waitUntil: "load" });
  await expect(page.getByRole("tab", { name: /What’s due/ })).toBeVisible();
  await page.getByRole("tab", { name: /What’s outstanding/ }).click();
  await expect(page.getByText(/does not currently collect or transfer funds/i)).toBeVisible();
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
  const heading = hero.getByRole("heading", { name: /Multiple clients. One clear picture./i });
  await expect(heading).toBeVisible();
  const box = await heading.boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(0);
  const firstLine = heading.locator("span").first();
  await expect(firstLine).toBeVisible();
  const firstBox = await firstLine.boundingBox();
  expect(firstBox?.y).toBeGreaterThanOrEqual(0);
  await expect(hero.getByTestId("hero-client-stage")).toBeVisible();
});
