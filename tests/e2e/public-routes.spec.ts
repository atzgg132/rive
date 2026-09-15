import { expect, test, type Page } from "@playwright/test";

const publicRoutes = ["/", "/about", "/changelog", "/contact", "/cookies", "/forgot-password", "/login", "/migrate-to-rive", "/pricing", "/privacy", "/product/clients-projects", "/product/agreements-invoices", "/product/portfolio", "/register", "/reset-password", "/roadmap", "/terms", "/verify-email", "/waitlist"] as const;

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

for (const route of publicRoutes) {
  test(`${route} renders without runtime errors`, async ({ page }) => {
    const errors = captureRuntimeErrors(page);
    const response = await page.goto(route, { waitUntil: "load" });
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
    expect(errors, `${route} emitted browser errors`).toEqual([]);
  });
}

test("marketing describes available capabilities without demo or payment theatre", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await expect(page.getByText("Watch Demo", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Remit", { exact: true })).toHaveCount(0);
  const funds = page.getByText(/does not collect or transfer funds/i).first();
  await funds.scrollIntoViewIfNeeded();
  await expect(funds).toBeVisible();
  const capability = page.getByText("Money on the record", { exact: true });
  await capability.scrollIntoViewIfNeeded();
  await expect(capability).toBeVisible();
});

test("pricing states account, beta, and export boundaries", async ({ page }) => {
  await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Free during beta. Clear about what’s included./i })).toBeVisible();
  await expect(page.getByText(/one operator per account/i).first()).toBeVisible();
  await expect(page.getByText(/Full workspace export is not currently available/i)).toBeVisible();
});

test("agreement marketing uses recorded acceptance rather than e-signature claims", async ({ page }) => {
  await page.goto("/product/agreements-invoices", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/record acceptance/i).first()).toBeVisible();
  await expect(page.getByText(/enforceability in every jurisdiction/i)).toBeVisible();
  await expect(page.getByText(/court-proof|legally binding everywhere/i)).toHaveCount(0);
});

test("login and registration password visibility controls remain usable", async ({ page }) => {
  await page.goto("/login", { waitUntil: "load" });
  const loginPassword = page.locator("#login-password");
  await loginPassword.fill("temporary-password");
  await page.getByRole("button", { name: "show password" }).click();
  await expect(loginPassword).toHaveAttribute("type", "text");

  await page.goto("/register", { waitUntil: "load" });
  const registerPassword = page.locator("#register-password");
  await registerPassword.fill("temporary-password");
  await page.getByRole("button", { name: "show password" }).click();
  await expect(registerPassword).toHaveAttribute("type", "text");
});

test("roadmap separates available work from future work", async ({ page }) => {
  await page.goto("/roadmap", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Where Rive goes next." })).toBeVisible();
  await expect(page.getByText("Available", { exact: true })).toBeVisible();
  await expect(page.getByText("Being worked on", { exact: true })).toBeVisible();
  await expect(page.getByText("Exploring", { exact: true })).toBeVisible();
  await expect(page.getByText(/not a delivery-date commitment/i)).toBeVisible();
});

test("legacy waitlist URL redirects to focused open signup", async ({ page }) => {
  await page.goto("/waitlist", { waitUntil: "load" });
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create your free account" })).toBeVisible();
});

test("an unpublished or unknown portfolio URL explains why it is unavailable", async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, "Requires a database-backed public portfolio lookup.");
  const response = await page.goto("/p/alpha-missing-portfolio", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  await expect(page.getByText("This portfolio is not available.")).toBeVisible();
});
