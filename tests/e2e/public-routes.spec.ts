import { expect, test, type Page } from "@playwright/test";

const publicRoutes = [
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
  "/forgot-password",
  "/guides",
  "/login",
  "/press",
  "/privacy",
  "/register",
  "/reset-password",
  "/roadmap",
  "/terms",
  "/verify-email",
  "/waitlist",
];

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  return errors;
}

for (const route of publicRoutes) {
  test(`${route} renders without runtime errors`, async ({ page }) => {
    const errors = captureRuntimeErrors(page);
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });

    expect(response, `${route} did not return a document response`).not.toBeNull();
    expect(response!.status(), `${route} returned ${response!.status()}`).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("load");
    await page.waitForTimeout(150);
    expect(errors, `${route} emitted browser errors`).toEqual([]);
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`system theme follows a new visitor's ${colorScheme} preference`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");

    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("rive-color-theme")))
      .toBeNull();
    if (colorScheme === "dark") {
      await expect(page.locator("html")).toHaveClass(/dark/);
    } else {
      await expect(page.locator("html")).not.toHaveClass(/dark/);
    }
    await expect(page.getByRole("button", { name: "Theme: system. Choose theme" })).toBeVisible();
  });
}

test("theme switcher glides between all options, collapses, and persists the choice", async ({ page }) => {
  await page.goto("/");

  const switcher = page.locator('[data-testid="theme-switcher"]:visible').first();
  await expect(switcher).toHaveCSS("width", "28px");
  await switcher.getByRole("button", { name: "Theme: system. Choose theme" }).click();
  const options = switcher.getByRole("radiogroup", { name: "Choose color theme" });
  await expect(options).toBeVisible();
  await expect(options).toHaveCSS("width", "92px");
  await expect(options).toHaveCSS("height", "28px");
  await expect(options).toHaveCSS("border-radius", "11px");
  await expect(options).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(page.getByTestId("theme-landing-surface")).toHaveCSS("width", "28px");
  await expect(page.getByTestId("theme-landing-surface")).toHaveCSS("height", "28px");
  await expect(page.getByTestId("theme-landing-surface")).toHaveCSS("border-radius", "11px");
  const iconGeometry = await page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>('[data-testid="theme-options"]')!;
    const current = document.querySelector<SVGElement>('[data-testid="theme-current-icon"]')!;
    const light = document.querySelector<SVGElement>('[data-testid="theme-light-icon"]')!;
    const dark = document.querySelector<SVGElement>('[data-testid="theme-dark-icon"]')!;
    const selected = document.querySelector<SVGElement>('[data-testid="theme-system-icon"]')!;
    const paneRect = pane.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    const lightRect = light.getBoundingClientRect();
    const darkRect = dark.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const optionCenters = [lightRect, darkRect, selectedRect]
      .map((rect) => rect.x + rect.width / 2);
    return {
      expandedCenterDelta: optionCenters.reduce((sum, center) => sum + center, 0) / optionCenters.length
        - (paneRect.x + paneRect.width / 2),
      current: {
        width: currentRect.width,
        height: currentRect.height,
        centerX: currentRect.x + currentRect.width / 2,
        centerY: currentRect.y + currentRect.height / 2,
      },
      selected: {
        width: selectedRect.width,
        height: selectedRect.height,
        centerX: selectedRect.x + selectedRect.width / 2,
        centerY: selectedRect.y + selectedRect.height / 2,
      },
    };
  });
  expect(iconGeometry.expandedCenterDelta).toBe(0);
  expect(iconGeometry.selected).toEqual(iconGeometry.current);
  await expect(switcher.getByRole("button", { name: "Theme: system. Choose theme" }))
    .toHaveCSS("outline-style", "none");
  await switcher.getByRole("radio", { name: "Light theme" }).click();
  await expect(switcher.getByRole("radio", { name: "Light theme" })).toBeChecked();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(switcher.getByTestId("theme-indicator")).toHaveAttribute("style", "transform: translateX(0px);");
  const marketingSurface = page.locator('[data-surface="marketing"]').first();
  await expect.poll(() => marketingSurface.evaluate((node) => getComputedStyle(node).backgroundColor))
    .not.toBe("rgb(5, 7, 12)");
  await expect.poll(() => marketingSurface.evaluate((node) => getComputedStyle(node).backgroundColor))
    .toBe("rgb(243, 245, 250)");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("rive-color-theme")))
    .toBe("light");
  await expect(switcher.getByRole("radiogroup", { name: "Choose color theme" })).toBeHidden();
  await expect(switcher.getByRole("button", { name: "Theme: light. Choose theme" })).toBeVisible();

  await switcher.getByRole("button", { name: "Theme: light. Choose theme" }).click();
  await expect(switcher.getByRole("radiogroup", { name: "Choose color theme" })).toBeVisible();
  await switcher.getByRole("radio", { name: "Dark theme" }).click();
  await expect(switcher.getByRole("radio", { name: "Dark theme" })).toBeChecked();
  await expect(switcher.getByTestId("theme-indicator")).toHaveAttribute("style", "transform: translateX(32px);");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect.poll(() => marketingSurface.evaluate((node) => getComputedStyle(node).backgroundColor))
    .toBe("rgb(5, 7, 12)");
  await expect(switcher.getByRole("button", { name: "Theme: dark. Choose theme" })).toBeVisible();

  await switcher.getByRole("button", { name: "Theme: dark. Choose theme" }).click();
  await expect(switcher.getByRole("radiogroup", { name: "Choose color theme" })).toBeVisible();
  await switcher.getByRole("radio", { name: "System theme" }).click();
  await expect(switcher.getByRole("radio", { name: "System theme" })).toBeChecked();
  await expect(switcher.getByTestId("theme-indicator")).toHaveAttribute("style", "transform: translateX(64px);");
  await expect(switcher.getByRole("button", { name: "Theme: system. Choose theme" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("rive-color-theme")))
    .toBe("system");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const reducedSwitcher = page.locator('[data-testid="theme-switcher"]:visible').first();
  await reducedSwitcher.getByRole("button", { name: "Theme: system. Choose theme" }).click();
  const reducedDuration = await reducedSwitcher.getByRole("radiogroup", { name: "Choose color theme" })
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).transitionDuration));
  expect(reducedDuration).toBeLessThanOrEqual(0.001);
});

test("marketing page advertises current connections without a demo CTA", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Watch Demo", { exact: true })).toHaveCount(0);
  await expect(page.getByText("An empty state is not a fresh start. It is another migration project.", { exact: true })).toBeVisible();
  await expect(page.getByText("CSV and XLSX imports", { exact: true })).toBeVisible();
  await expect(page.getByText("Contracts & acceptance", { exact: true })).toBeVisible();
});

test("marketing homepage does not sell Remit as a transfer or payout product", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Know the payout before you send it.")).toHaveCount(0);
  await expect(page.getByText("Payouts should follow the Agreement.")).toHaveCount(0);
  await expect(page.getByText("international payouts")).toHaveCount(0);
  await expect(page.getByText("You send", { exact: true })).toHaveCount(0);
  await expect(page.getByText("They receive", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Watch Demo", { exact: true })).toHaveCount(0);
});

test("login password visibility control works", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  // The control is server-rendered, so wait for the client bundle to hydrate
  // before asserting an interaction rather than racing React's event binding.
  await page.waitForLoadState("load");
  await expect(page.locator('form[data-testid="login-form"][data-hydrated="true"]')).toBeVisible();
  const password = page.locator("#login-password");
  const showPassword = page.getByRole("button", { name: "show password" });

  await expect(password).toHaveCount(1);
  await expect(showPassword).toHaveCount(1);
  await expect(showPassword).toBeEnabled();
  await password.fill("temporary-password");
  await showPassword.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("temporary-password");

  const hidePassword = page.getByRole("button", { name: "hide password" });
  await expect(hidePassword).toHaveCount(1);
  await hidePassword.click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveValue("temporary-password");
});

test("registration password visibility control works for invited users", async ({ page }) => {
  await page.goto("/register?invite=e2e-invalid-invite");
  await expect(page.locator('form[data-testid="register-form"][data-hydrated="true"]')).toBeVisible();
  const password = page.locator('input[type="password"]');
  const showPassword = page.getByRole("button", { name: "show password" });

  await expect(password).toHaveCount(1);
  await expect(showPassword).toHaveCount(1);
  await showPassword.click();
  await expect(page.locator('input[type="text"]')).toHaveCount(2);
});

test("marketing does not claim Google Calendar is available", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Google Calendar" })).toHaveCount(0);

  await page.goto("/roadmap", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Apple Calendar feed", { exact: true })).toBeVisible();
  await expect(page.getByText("activation analytics")).toHaveCount(0);
  await expect(page.getByText("once Google approves the integration")).toBeVisible();
});

test("changelog and roadmap describe the open-beta product, not a private alpha", async ({ page }) => {
  await page.goto("/changelog", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Open beta", exact: true })).toBeVisible();
  await expect(page.getByText("Latest", { exact: true }).first()).toBeVisible();

  await page.goto("/roadmap", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Open beta is live. Next we make it dependable." })).toBeVisible();
  await expect(page.getByText("private-alpha")).toHaveCount(0);
  await expect(page.getByText("early-access")).toHaveCount(0);
});

test("guides do not advertise unshipped Remit transfers or an AI co-pilot", async ({ page }) => {
  await page.goto("/guides", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("ai co-pilot", { exact: false })).toHaveCount(0);
  await expect(page.getByText("sending your first payment with remit", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Reviewing and recording an Agreement" })).toBeVisible();
});

test("legacy waitlist URL gracefully redirects to open signup", async ({ page }) => {
  await page.goto("/waitlist", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create your Rive workspace" })).toBeVisible();
});

test("an unpublished or unknown portfolio URL explains why it is unavailable", async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, "Requires a database-backed public portfolio lookup.");
  const response = await page.goto("/p/alpha-missing-portfolio", { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBe(404);
  await expect(page.getByText("This portfolio is not available.")).toBeVisible();
});
