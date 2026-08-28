import { expect, test, type Page } from "@playwright/test";

async function mockSession(page: Page, onboardingStatus = "complete") {
  await page.route("**/api/auth/session", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: {
          id: "login-test-user",
          name: "Login Tester",
          email: "login@rive.test",
          plan: "free",
          onboarding_status: onboardingStatus,
          display_currency: "USD",
        },
        featureAvailability: { agreements: true },
      }),
    });
  });
  await page.route("**/api/activation", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        activation: {
          goal: "organize",
          recommendedAction: { id: "first_client", label: "Add your first client", href: "/workflow/clients?new=true" },
          milestones: [],
        },
      }),
    });
  });
  await page.route("**/api/notifications**", async (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, notifications: [] }) });
  });
  await page.route("**/api/calendar/**", async (route) => {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, events: [], calendars: [], tasks: [] }) });
  });
  await page.route("**/api/workflow/dashboard", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        stats: { clients: 0, projects: 0, invoices: 0, expenses: 0 },
      }),
    });
  });
}

async function openLogin(page: Page, path = "/login") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator('form[data-testid="login-form"][data-hydrated="true"]')).toBeVisible();
  await expect(page.getByTestId("login-submit")).toBeEnabled();
}

async function fillLogin(page: Page, email = "login@rive.test") {
  await page.getByLabel("Email address").fill(email);
  await page.locator("#login-password").fill("temporary-password");
}

test("invalid credentials surface an alert and keep the form", async ({ page }) => {
  await page.route("**/api/auth/login**", async (route) => {
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "Invalid email or password." }),
    });
  });
  await openLogin(page);
  await fillLogin(page);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-alert")).toContainText("Invalid email or password.");
  await expect(page.getByLabel("Email address")).toHaveValue("login@rive.test");
  await expect(page.getByTestId("login-submit")).toBeEnabled();
});

test("unverified accounts can resend without leaving login", async ({ page }) => {
  await page.route("**/api/auth/login**", async (route) => {
    return route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before signing in.",
      }),
    });
  });
  await page.route("**/api/auth/verify-email/resend**", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "If an account needs verification, a fresh link is on its way." }),
    });
  });
  await openLogin(page);
  await fillLogin(page);
  await page.getByTestId("login-submit").click();
  await expect(page.getByRole("heading", { name: "Verify your email to continue" })).toBeVisible();
  await expect(page.getByText("login@rive.test")).toBeVisible();
  await page.getByRole("button", { name: "Resend verification" }).click();
  await expect(page.getByTestId("login-notice")).toContainText("fresh link is on its way");
  await expect(page).toHaveURL(/\/login/);
});

test("email query prefills the address field", async ({ page }) => {
  await openLogin(page, "/login?email=prefill%40rive.test");
  await expect(page.getByLabel("Email address")).toHaveValue("prefill@rive.test");
});

test("a completed operator follows a safe next path", async ({ page }) => {
  await mockSession(page, "complete");
  await page.route("**/api/auth/login**", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, destination: "/dashboard" }),
    });
  });
  await openLogin(page, "/login?next=/calendar");
  await fillLogin(page);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/calendar/, { timeout: 15_000 });
});

test("log in from the marketing header stays on the page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "load" });
  await page.getByTestId("site-header").locator("a[href='/login']").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("login-submit")).toBeEnabled();
  await expect(page.getByTestId("marketing-hero")).toBeVisible();
  await expect(page).toHaveURL(/auth=login/);
  await expect(page).not.toHaveURL(/\/login/);
});

test("an off-origin next path is ignored", async ({ page }) => {
  await mockSession(page, "complete");
  await page.route("**/api/auth/login**", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, destination: "/dashboard" }),
    });
  });
  await openLogin(page, "/login?next=https://evil.example/phish");
  await fillLogin(page);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page).not.toHaveURL(/evil/);
});

test("Google sign-in appears when the OAuth client is configured", async ({ page }) => {
  await page.route("**/api/auth/providers**", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, google: true }),
    });
  });
  await openLogin(page);
  await expect(page.getByTestId("google-sign-in")).toBeVisible();
  await expect(page.getByTestId("google-sign-in")).toHaveAttribute("href", "/api/auth/google/start");
});

test("a Google sign-in error is shown on the login form", async ({ page }) => {
  await openLogin(page, "/login?google_error=access_denied");
  await expect(page.getByTestId("login-alert")).toContainText("Google sign-in was cancelled.");
});
