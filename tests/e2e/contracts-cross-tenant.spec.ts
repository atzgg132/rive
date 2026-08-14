import { createHmac } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { checkServerIdentity } from "node:tls";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

/**
 * Cross-tenant authorization regression tests for Agreements (Goal 4).
 *
 * Two distinct authenticated users; user B attempts every route on user A's
 * contract. Every attempt must 404 — never 403 — so an attacker cannot even
 * learn that the record exists (no existence leakage, consistent with the
 * current behavior of every contracts route).
 *
 * Requires a database with two seeded users. User A is `E2E_USER_EMAIL`;
 * user B is created via the register endpoint in global setup so the test is
 * self-contained and needs no second env var. Skipped when no DB is present,
 * like the rest of the authenticated suite.
 */

let usersPromise: Promise<{ userA: { token: string; clientId: string }; userB: { token: string } }> | undefined;

async function signSessionToken(payload: Record<string, unknown>): Promise<string> {
  const secret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-development-session-secret";
  const signature = createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
  return Buffer.from(`${JSON.stringify(payload)}.${signature}`).toString("base64");
}

async function getUsers() {
  if (!usersPromise) {
    usersPromise = (async () => {
      loadEnvConfig(process.cwd());
      const emailA = process.env.E2E_USER_EMAIL?.trim().toLowerCase();
      if (!emailA) throw new Error("E2E_USER_EMAIL is required for cross-tenant contract tests.");
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new Error("DATABASE_URL is required for cross-tenant contract tests.");

      const ssl =
        process.env.DATABASE_SSL === "disable" || databaseUrl.includes("sslmode=disable")
          ? false
          : {
              rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
              ...(process.env.DATABASE_SSL_SERVERNAME
                ? {
                    checkServerIdentity: (_hostname: string, certificate: Parameters<typeof checkServerIdentity>[1]) =>
                      checkServerIdentity(process.env.DATABASE_SSL_SERVERNAME!, certificate),
                  }
                : {}),
            };
      const parsed = new URL(databaseUrl);
      for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsed.searchParams.delete(parameter);
      const pool = new Pool({ connectionString: parsed.toString(), ssl });
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

      try {
        const userA = await prisma.user.findUnique({
          where: { email: emailA },
          select: { id: true, email: true, plan: true, sessionVersion: true },
        });
        if (!userA) throw new Error(`No test user exists for ${emailA}.`);

        // User B: a distinct tenant created directly via Prisma. The register
        // API requires a waitlist invite, so a self-created fixture user is the
        // established pattern (see scripts/smoke-contracts.mjs). Disposable
        // address under @example.invalid; never deleted.
        const emailB = `cross-tenant-${Date.now()}-${process.pid}@example.invalid`;
        const userB = await prisma.user.create({
          data: {
            email: emailB,
            name: "Cross Tenant B",
            passwordHash: "e2e-only",
            plan: "pro",
            onboardingStatus: "complete",
            onboardingStep: 5,
            businessType: "freelancer",
            profession: "Product designer",
            currency: "USD",
            timeZone: "Asia/Kolkata",
          },
          select: { id: true, email: true, plan: true, sessionVersion: true },
        });

        const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
        const tokenA = await signSessionToken({
          userId: userA.id, email: userA.email, plan: userA.plan, sessionVersion: userA.sessionVersion, expiry,
        });
        const tokenB = await signSessionToken({
          userId: userB.id, email: userB.email, plan: userB.plan, sessionVersion: userB.sessionVersion, expiry,
        });

        // A client owned by user A so the fixture contract has a valid owner.
        const client = await prisma.client.create({
          data: {
            userId: userA.id,
            name: "Cross-tenant fixture client",
            email: `cross-tenant-client-${Date.now()}@example.invalid`,
            status: "active",
          },
          select: { id: true },
        });

        return {
          userA: { token: tokenA, clientId: client.id },
          userB: { token: tokenB },
        };
      } finally {
        await prisma.$disconnect();
        await pool.end();
      }
    })();
  }
  return usersPromise;
}

const cookieFor = (token: string) => `rive_session=${token}`;

test.describe("cross-tenant agreement isolation", () => {
  test.skip(!process.env.E2E_USER_EMAIL, "Set E2E_USER_EMAIL and DATABASE_URL to run cross-tenant contract tests.");

  test("user B cannot read, edit, finalize, review, sign, or delete user A's contract", async ({ request }) => {
    const { userA, userB } = await getUsers();

    // Create a contract as user A with a request id, so we know which record
    // belongs to A.
    const create = await request.post("/api/workflow/contracts", {
      headers: { cookie: cookieFor(userA.token), "Idempotency-Key": `cross-tenant-${Date.now()}` },
      data: {
        title: "Cross-tenant isolation target",
        clientId: userA.clientId,
        currency: "USD",
      },
    });
    expect(create.status(), `contract creation should succeed: ${await create.text()}`).toBe(201);
    const { contractId } = await create.json();
    expect(contractId).toBeTruthy();

    // Every route on A's contract, attempted as B. All must 404.
    const attempts: Array<{ method: "GET" | "PUT" | "DELETE" | "POST"; url: string; data?: unknown }> = [
      { method: "GET", url: `/api/workflow/contracts/${contractId}` },
      { method: "GET", url: `/api/workflow/contracts/${contractId}/artifact` },
      { method: "PUT", url: `/api/workflow/contracts/${contractId}`, data: { title: "stolen" } },
      { method: "DELETE", url: `/api/workflow/contracts/${contractId}` },
      { method: "POST", url: `/api/workflow/contracts/${contractId}/review`, data: {} },
      { method: "POST", url: `/api/workflow/contracts/${contractId}/finalize`, data: {} },
      { method: "POST", url: `/api/workflow/contracts/${contractId}/start-signing`, data: {} },
      { method: "POST", url: `/api/workflow/contracts/${contractId}/signing-links`, data: { role: "client" } },
      { method: "POST", url: `/api/workflow/contracts/${contractId}/comments`, data: { body: "stolen comment" } },
      { method: "POST", url: `/api/workflow/contracts/${contractId}/billing/run`, data: {} },
    ];

    for (const attempt of attempts) {
      const response = await request.fetch(attempt.url, {
        method: attempt.method,
        headers: { cookie: cookieFor(userB.token) },
        data: attempt.data,
      });
      // 404, never 403: existence must not leak across tenants.
      expect(response.status(), `${attempt.method} ${attempt.url} should 404 for another tenant`).toBe(404);
    }

    // Public token routes: a bearer token that resolves to nothing (or to
    // another user's record) must 404, not reveal existence.
    const publicAttempts: Array<{ method: "GET" | "POST"; url: string; data?: unknown }> = [
      { method: "GET", url: "/api/public/contracts/review/not-a-real-token" },
      { method: "POST", url: "/api/public/contracts/review/not-a-real-token", data: { decision: "approve" } },
      { method: "GET", url: "/api/public/contracts/sign/not-a-real-token" },
      { method: "POST", url: "/api/public/contracts/sign/not-a-real-token", data: { name: "Attacker" } },
      { method: "GET", url: "/api/public/contracts/artifact/not-a-real-token" },
    ];
    for (const attempt of publicAttempts) {
      const response = await request.fetch(attempt.url, {
        method: attempt.method,
        data: attempt.data,
      });
      // A public link either 404s (unknown token) or 410s (expired/revoked);
      // it must never resolve to a different tenant's contract.
      expect([404, 410], `${attempt.method} ${attempt.url} should refuse an unknown token`).toContain(response.status());
    }
  });
});
