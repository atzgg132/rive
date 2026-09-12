import { expect, test, type Page } from "@playwright/test";

/**
 * Calendar connection health states: a revoked Google grant must surface as
 * "Reconnect needed" with a working Reconnect CTA and a reachable Disconnect —
 * the exact affordances that were missing when symptom 1 stranded users.
 */

type ConnectionState = "connected" | "needs_reconnect" | "error";

function googleConnection(status: ConnectionState) {
  return {
    id: `conn-${status}`,
    provider: "google",
    accountEmail: "staging.tester@gmail.com",
    status,
    defaultExternalCalendarId: status === "connected" ? "ext-1" : null,
    lastSyncedAt: status === "connected" ? "2026-03-10T09:30:00.000Z" : null,
    lastError: status === "connected" ? null : "Google authorization was revoked. Reconnect the account.",
    createdAt: "2026-03-01T00:00:00.000Z",
    externalCalendars:
      status === "connected"
        ? [{ id: "ext-1", providerCalendarId: "primary", name: "staging.tester@gmail.com", color: "#4285F4", accessRole: "owner", selected: true, lastSyncedAt: "2026-03-10T09:30:00.000Z" }]
        : [],
  };
}

async function installCalendarMocks(page: Page, connections: ReturnType<typeof googleConnection>[], outbox = { pending: 0, failed: 0 }) {
  const deletedIds: string[] = [];
  await page.route("**/api/auth/session**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: { id: "user-1", email: "tester@rive.test", name: "Calendar Tester", plan: "free", onboarding_status: "complete", time_zone: "Asia/Kolkata" },
        featureAvailability: { agreements: true, engagementFlow: true },
      }),
    }),
  );
  await page.route("**/api/notifications**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, notifications: [] }) }));
  await page.route("**/api/activation**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: false }) }));
  await page.route("**/api/calendar/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    if (pathname === "/api/calendar/events") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, events: [] }) });
    if (pathname === "/api/calendar/calendars") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, calendars: [] }) });
    if (pathname === "/api/calendar/tasks") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, tasks: [] }) });
    if (pathname === "/api/calendar/connections") {
      if (route.request().method() === "DELETE") {
        deletedIds.push(url.searchParams.get("id") || "");
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, connections, outbox, connectorAvailability: { googleCalendar: true } }),
      });
    }
    if (pathname === "/api/calendar/connections/google/sync") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
  return () => deletedIds;
}

test.describe("calendar connection health", () => {
  test("a revoked grant shows Reconnect needed with working Reconnect and Disconnect", async ({ page }) => {
    const deleted = await installCalendarMocks(page, [googleConnection("needs_reconnect")]);
    page.on("dialog", (dialog) => void dialog.accept());
    await page.goto("/calendar", { waitUntil: "load" });

    await page.getByRole("button", { name: /Calendar feeds|synced/ }).click();
    await expect(page.getByRole("heading", { name: "Calendar connections" })).toBeVisible();
    await expect(page.getByText("staging.tester@gmail.com").first()).toBeVisible();
    await expect(page.getByText("Reconnect needed")).toBeVisible();
    await expect(page.getByText("Google authorization was revoked. Reconnect the account.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Reconnect" })).toHaveAttribute("href", "/api/calendar/connections/google/start");

    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect.poll(() => deleted()).toContain("conn-needs_reconnect");
  });

  test("a healthy connection shows Connected and hides the Reconnect CTA", async ({ page }) => {
    await installCalendarMocks(page, [googleConnection("connected")]);
    await page.goto("/calendar", { waitUntil: "load" });

    await page.getByRole("button", { name: /synced/ }).click();
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reconnect" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
    await expect(page.getByText("staging.tester@gmail.com").first()).toBeVisible();
    await expect(page.getByText("owner", { exact: true })).toBeVisible();
  });

  test("failed outbox jobs surface a stop-retrying notice in the connections modal", async ({ page }) => {
    await installCalendarMocks(page, [googleConnection("connected")], { pending: 1, failed: 2 });
    await page.goto("/calendar", { waitUntil: "load" });

    await page.getByRole("button", { name: /synced/ }).click();
    await expect(page.getByText("2 calendar changes could not reach Google and stopped retrying.", { exact: false })).toBeVisible();
  });
});
