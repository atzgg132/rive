import { expect, test } from "@playwright/test";

const protectedGetRoutes = [
  "/api/auth/session",
  "/api/onboarding",
  "/api/onboarding/import/jobs",
  "/api/onboarding/import/mappings",
  "/api/connectors",
  "/api/portfolio",
  "/api/portfolio/analytics",
  "/api/workflow/dashboard",
  "/api/activation",
  "/api/workflow/clients",
  "/api/workflow/projects",
  "/api/workflow/contracts",
  "/api/workflow/expenses",
  "/api/workflow/invoices",
  "/api/notifications",
  "/api/calendar/events",
  "/api/calendar/tasks",
  "/api/calendar/connections",
  "/api/admin/waitlist",
  // Behind a flag: 404 while disabled, 401 when enabled. Either way it must
  // never serve migration data to an unauthenticated caller.
  "/api/migrations",
];

const flaggedRoutes = new Set(["/api/migrations"]);

for (const route of protectedGetRoutes) {
  test(`${route} rejects unauthenticated access`, async ({ request }) => {
    const response = await request.get(route);
    const acceptable = flaggedRoutes.has(route) ? [401, 404] : [401];
    expect(acceptable, `${route} should be protected, got ${response.status()}`).toContain(response.status());
  });
}

test("/api/connectors/zoho-books/sync rejects unauthenticated access", async ({ request }) => {
  const response = await request.post("/api/connectors/zoho-books/sync", { data: {} });
  expect(response.status()).toBe(401);
});

test("/api/admin/waitlist/[id] rejects requests without an admin token", async ({ request }) => {
  const response = await request.patch("/api/admin/waitlist/13", {
    data: { status: "approved" },
  });
  expect(response.status()).toBe(401);
});

test("registration validates malformed input on the server", async ({ request }) => {
  const response = await request.post("/api/auth/register", {
    data: {
      email: "not-an-email",
      name: "",
      password: "short",
      inviteToken: "",
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ success: false });
});

test("login validates missing credentials on the server", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    data: { email: "", password: "" },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ success: false });
});

test("/api/guidance rejects unauthenticated access", async ({ request }) => {
  const response = await request.post("/api/guidance", { data: { event: "started", mode: "automatic" } });
  expect(response.status()).toBe(401);
});

test("a spoofed identity header cannot authenticate a request", async ({ request }) => {
  const response = await request.get("/api/auth/session", {
    headers: {
      "x-user-session": JSON.stringify({ userId: "another-user", email: "attacker@example.com", plan: "pro", expiry: Date.now() + 60_000 }),
    },
  });

  expect(response.status()).toBe(401);
});
