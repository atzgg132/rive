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
];

for (const route of protectedGetRoutes) {
  test(`${route} rejects unauthenticated access`, async ({ request }) => {
    const response = await request.get(route);
    expect(response.status(), `${route} should be protected`).toBe(401);
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
