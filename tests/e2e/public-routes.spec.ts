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
    expect(errors, `${route} emitted browser errors`).toEqual([]);
  });
}

test("light theme is the default for a new visitor", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("marketing page advertises current connections without a demo CTA", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Watch Demo", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Start with the data you already have.", { exact: true })).toBeVisible();
  await expect(page.getByText("CSV and XLSX imports", { exact: true })).toBeVisible();
  await expect(page.getByText("Contracts & acceptance", { exact: true })).toBeVisible();
});

test("login password visibility control works", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
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
  const password = page.locator('input[type="password"]');
  const showPassword = page.getByRole("button", { name: "show password" });

  await expect(password).toHaveCount(1);
  await expect(showPassword).toHaveCount(1);
  await showPassword.click();
  await expect(page.locator('input[type="text"]')).toHaveCount(2);
});

test("legacy waitlist URL gracefully redirects to open signup", async ({ page }) => {
  await page.goto("/waitlist", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: "Create your Rive workspace" })).toBeVisible();
});

test("an unpublished or unknown portfolio URL explains why it is unavailable", async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, "Requires a database-backed public portfolio lookup.");
  const response = await page.goto("/p/alpha-missing-portfolio", { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBe(404);
  await expect(page.getByText("This portfolio is not available.")).toBeVisible();
});
