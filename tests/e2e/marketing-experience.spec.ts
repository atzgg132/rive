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

test.describe("institution marketing experience", () => {
  test("the first screen explains the audience, product, and offer", async ({ page }) => {
    const errors = captureRuntimeErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });

    const hero = page.getByTestId("marketing-hero");
    await expect(hero.getByRole("heading", { name: /every client[\s\S]*one record/i })).toBeVisible();
    await expect(hero).toContainText("freelancers and independent businesses");
    await expect(hero).toContainText("client, project, agreement, invoice, and deadline");
    await expect(hero.getByRole("link", { name: "Start free", exact: true })).toBeVisible();
    await expect(hero).toContainText("No credit card required");
    await expect(hero.locator(".inst-titlepage__bg")).toBeAttached();
    await expect(page.getByText("Remit", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("read the register glides to the registry instead of jumping", async ({ page }) => {
    const errors = captureRuntimeErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });
    const hero = page.getByTestId("marketing-hero");

    await hero.getByRole("link", { name: "Read the register" }).click();

    // Sample the travel: a native hash jump lands in one frame, so an
    // intermediate scrollY strictly between 0 and the target proves the
    // animated path ran.
    const samples: number[] = [];
    for (let i = 0; i < 18; i += 1) {
      samples.push(await page.evaluate(() => window.scrollY));
      await page.waitForTimeout(90);
    }
    const target = await page.locator("#registry").evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const final = samples.at(-1) ?? 0;
    expect(samples.some((y) => y > 4 && y < target - 200)).toBe(true);
    expect(Math.abs(final - (target - 96))).toBeLessThan(24); // lands inside the 6rem scroll margin
    await expect(page).toHaveURL(/#registry$/);
    expect(errors).toEqual([]);
  });

  test("the registry carries one record through the departments", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const journey = page.getByTestId("record-journey");
    await expect(journey.getByRole("heading", { name: "One file, every department." })).toBeVisible();
    const record = journey.locator(".inst-journey__rail .inst-record");
    await expect(record).toBeVisible();
    await expect(record).toContainText("Aster House");
    await journey.locator(".inst-dept-row").nth(3).scrollIntoViewIfNeeded();
    await expect(record).toContainText("Terms accepted");
    await expect(record).toContainText("INV-024");
  });

  test("real workspace plates document the product", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const figures = page.locator("section[aria-label='Workspace figures']");
    const preview = figures.locator("[data-workspace-preview]:visible").first();
    await expect(preview).toBeVisible();
    await expect(preview.getByText("Search workspace...")).toBeVisible();
    await expect(preview).toContainText("Cash collected");
    await expect(preview.getByText(/Aster House/).first()).toBeVisible();
  });

  test("the published record shows the whole public page beside its register entry", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const published = page.locator("section[aria-label='Published portfolio']");
    const publicPlate = published.locator(".inst-plate");
    await expect(publicPlate).toHaveCount(1);
    await expect(publicPlate).toContainText("Minimal pro · live render");
    await expect(publicPlate.locator(".inst-specimen:visible")).toHaveJSProperty("inert", true);
    await expect(publicPlate.locator(".portfolio-footer").first()).toContainText("Built with Rive");
    await expect(published.getByTestId("portfolio-showcase")).toContainText("Settings");
  });

  test("the specification discloses capability boundaries", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const spec = page.locator("section[aria-label='Specification']");
    await expect(spec.getByText(/does not collect or transfer funds/i)).toBeVisible();
    await expect(spec.getByText(/not a guarantee of enforceability/i)).toBeVisible();
    await expect(spec.getByText(/Shared team access is not available yet/i)).toBeVisible();
  });

  test("closed mobile navigation stays out of the tab order and Escape restores focus", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "load" });
    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await menuButton.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("marketing-hero").getByRole("link", { name: "Start free", exact: true })).toBeFocused();
    await menuButton.click();
    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(mobileNav).toBeVisible();
    await mobileNav.getByRole("link", { name: "Clients & projects" }).focus();
    await page.keyboard.press("Escape");
    await expect(mobileNav).toHaveCount(0);
    await expect(menuButton).toBeFocused();
  });

  test("the homepage carries the full narrative without hiding the signup case below the fold", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "The record, set in public." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No fee. No card. One operator." })).toBeVisible();
    await expect(page.locator(".inst-admit__fee")).toContainText("Free");
    await expect(page.getByTestId("faq-grid").locator("details")).toHaveCount(5);
    await expect(page.getByRole("heading", { name: /Start your record./i })).toBeVisible();
    await expect(page.locator(".inst-seal")).toBeVisible();
  });

  test("faq accordion keeps a single item open", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const faqItems = page.getByTestId("faq-grid").locator("details");
    await expect(faqItems.nth(0)).toHaveJSProperty("open", true);
    await faqItems.nth(1).locator("summary").click();
    await expect(faqItems.nth(1)).toHaveJSProperty("open", true);
    await expect(faqItems.nth(0)).toHaveJSProperty("open", false);
    await faqItems.nth(1).locator("summary").click();
    await expect(faqItems.nth(1)).toHaveJSProperty("open", false);
  });

  test("primary navigation exposes focused product and pricing routes", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(nav.getByRole("link", { name: /Product/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Pricing/ })).toHaveAttribute("href", "/pricing");
    await expect(nav.getByRole("link", { name: /About/ })).toHaveAttribute("href", "/about");
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
    const journey = page.getByTestId("record-journey");
    // Inline plates carry every record state; the sticky rail is retired.
    await expect(journey.locator(".inst-dept-row__plate .inst-record")).toHaveCount(5);
    await expect(journey.locator(".inst-journey__rail")).toBeHidden();
    await expect(page.getByRole("heading", { name: "One file, every department." })).toBeVisible();
    await expect(page.getByTestId("portfolio-showcase")).toBeVisible();
    const clip = await page.locator(".inst-manifesto__fill").evaluate((node) => getComputedStyle(node).position);
    expect(clip).toBe("static");
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
