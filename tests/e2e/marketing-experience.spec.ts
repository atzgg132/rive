import { expect, test, type Page } from "@playwright/test";

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

const marketingRoutes = [
  "/",
  "/product/clients-projects",
  "/product/agreements-invoices",
  "/product/portfolio",
  "/pricing",
  "/migrate-to-rive",
  "/about",
  "/changelog",
  "/roadmap",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
] as const;

test.describe("working edition marketing experience", () => {
  test("the first screen explains the audience, product, and offer", async ({ page }) => {
    const errors = captureRuntimeErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });

    const hero = page.getByTestId("marketing-hero");
    await expect(hero.getByRole("heading", { name: /Multiple clients. One clear picture./i })).toBeVisible();
    await expect(hero).toContainText("independent businesses managing multiple clients");
    await expect(hero).toContainText("clients, projects, agreements, invoices, and expenses");
    await expect(hero.getByRole("link", { name: "Start free", exact: true })).toBeVisible();
    await expect(hero).toContainText("No credit card required");
    await expect(page.getByText("Remit", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the hero shows a faithful Rive workspace rather than invented browser chrome", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const stage = page.getByTestId("hero-client-stage");
    await expect(stage).toContainText("Inside Rive");
    const preview = stage.locator("[data-workspace-preview]:visible");
    await expect(preview).toBeVisible();
    await expect(preview.getByText("Search workspace…")).toBeVisible();
    await expect(preview).toContainText("Revenue collected");
    await expect(preview.getByText(/Aster House/)).toBeVisible();
    await expect(stage.getByText("rive.work", { exact: true })).toHaveCount(0);
  });

  test("product questions are keyboard-reachable and disclose capability boundaries", async ({ page }) => {
    await page.goto("/#product", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: "What needs your attention?" })).toBeVisible();
    const outstanding = page.getByRole("tab", { name: /What’s outstanding/ });
    await outstanding.click();
    await expect(outstanding).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Keep an eye on the money." })).toBeVisible();
    await expect(page.getByText(/does not currently collect or transfer funds/i)).toBeVisible();
  });

  test("the homepage carries the full narrative without hiding the signup case below the fold", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Make room for the work you want to show." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start with one client. Not a migration project." })).toBeVisible();
    await expect(page.locator("#pricing")).toContainText("Free");
    await expect(page.getByTestId("faq-grid").locator("details")).toHaveCount(6);
    await expect(page.getByRole("heading", { name: /Your next client project can start here./i })).toBeVisible();
  });

  test("primary navigation exposes focused product and pricing routes", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(nav.getByRole("link", { name: "Product", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Pricing", exact: true })).toHaveAttribute("href", "/pricing");
    await expect(nav.getByRole("link", { name: "About", exact: true })).toHaveAttribute("href", "/about");
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: "Clients & projects" })).toHaveAttribute("href", "/product/clients-projects");
    await expect(footer.getByRole("link", { name: "Agreements & invoices" })).toHaveAttribute("href", "/product/agreements-invoices");
  });

  for (const route of marketingRoutes) {
    test(`${route} has one clear page heading and emits no runtime errors`, async ({ page }) => {
      const errors = captureRuntimeErrors(page);
      const response = await page.goto(route, { waitUntil: "load" });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(errors).toEqual([]);
    });
  }

  test("signup opens a focused overlay and preserves the account form", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("rive-color-theme", "dark"));
    await page.goto("/", { waitUntil: "load" });
    await page.getByTestId("marketing-hero").getByRole("link", { name: "Start free", exact: true }).click();
    await expect(page).toHaveURL(/\?auth=register/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator(".auth-overlay-backdrop")).toHaveCSS("background-color", "rgba(0, 0, 0, 0.4)");
    await expect(page.getByRole("heading", { name: "Create your free account" })).toBeVisible();
    await expect(page.getByTestId("register-form")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("No credit card required.")).toBeVisible();
  });

  test("legacy query auth links remain usable and count as signup starts", async ({ page }) => {
    let trackedPath = "";
    await page.route("**/api/track", async (route) => {
      const body = route.request().postDataJSON() as { path?: string };
      trackedPath = body.path || "";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    });
    await page.goto("/?auth=register", { waitUntil: "load" });
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("register-form")).toBeVisible();
    await expect.poll(() => trackedPath).toBe("/register");
  });

  test("reduced motion keeps all core content and controls available", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByTestId("hero-client-stage")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What needs your attention?" })).toBeVisible();
    await expect(page.getByTestId("portfolio-showcase")).toBeVisible();
    const animation = await page.locator(".edition-question-visual").evaluate((node) => getComputedStyle(node).animationName);
    expect(animation).toBe("none");
  });

  test("marketing metadata and organization schema describe Rive", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle("Rive — Multiple clients. One clear picture.");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Manage clients, projects, agreements, invoices, and expenses/);
    const schema = await page.locator('script[type="application/ld+json"]').textContent();
    expect(schema).toContain('"name":"Rive"');
    expect(schema).toContain("rive-wordmark.svg");
  });
});
