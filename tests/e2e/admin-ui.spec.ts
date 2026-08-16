import { expect, test, type Route } from "@playwright/test";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.describe("admin control room", () => {
  test("keeps the admin login primary action usable", async ({ page }) => {
    await page.route("**/api/admin/session", (route) =>
      json(route, { success: false }, 401),
    );

    await page.goto("/admin");

    const signIn = page.getByRole("button", { name: "Sign in securely" });
    await expect(signIn).toBeVisible();
    await expect(signIn).toBeEnabled();
    await expect(signIn).toHaveClass(/bg-primary/);
  });

  test("shows a retryable state when funnel analytics are unavailable", async ({
    page,
  }) => {
    await page.route("**/api/admin/session", (route) =>
      json(route, { success: true }),
    );
    await page.route("**/api/admin/analytics", (route) =>
      json(route, {
        success: true,
        data: {
          productFunnel: null,
          productFunnelStatus: "unavailable",
        },
      }),
    );
    await page.route("**/api/admin/users*", (route) =>
      json(route, { success: true, users: [] }),
    );

    await page.goto("/admin");

    await expect(
      page.getByRole("alert").filter({ hasText: "This admin data is" }),
    ).toContainText(
      "temporarily unavailable",
    );
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Users" })).toBeVisible();

    await page.getByRole("button", { name: "Users" }).click();
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  });
});
