import crypto from "crypto";
import { checkServerIdentity } from "node:tls";
import { PrismaPg } from "@prisma/adapter-pg";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

test.describe("admin waitlist operations", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!process.env.DATABASE_URL, "A test database is required for waitlist integration checks.");

  const email = `e2e-waitlist-${Date.now()}-${process.pid}@example.com`;
  let prisma: PrismaClient;
  let adminToken: string;
  let waitlistId: number;

  test.beforeAll(async () => {
    const { generateToken } = await import("../../src/utils/auth");
    const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
    const parsedConnectionString = new URL(process.env.DATABASE_URL!);
    for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsedConnectionString.searchParams.delete(parameter);
    const pool = new Pool({
      connectionString: parsedConnectionString.toString(),
      ssl: process.env.DATABASE_SSL === "disable" || process.env.DATABASE_URL?.includes("sslmode=disable")
        ? false
        : {
            rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
            ...(sslServerName ? { checkServerIdentity: (_hostname: string, certificate: Parameters<typeof checkServerIdentity>[1]) => checkServerIdentity(sslServerName, certificate) } : {}),
          },
    });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    adminToken = generateToken();

    const entry = await prisma.waitlist.create({
      data: { email, type: "waitlist" },
    });
    waitlistId = entry.id;
  });

  test.afterAll(async () => {
    if (!prisma || !waitlistId) return;

    await prisma.auditEvent.deleteMany({
      where: { targetType: "waitlist", targetId: String(waitlistId) },
    });
    await prisma.emailDelivery.deleteMany({ where: { recipient: email } });
    await prisma.authToken.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.waitlist.deleteMany({ where: { id: waitlistId } });
    await prisma.$disconnect();
  });

  test("approval persists when invitation delivery is unavailable", async ({ request }) => {
    const response = await request.patch(`/api/admin/waitlist/${waitlistId}`, {
      headers: { "x-admin-token": adminToken },
      data: { status: "approved" },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      emailSent: false,
      data: {
        email,
        status: "approved",
        registered: false,
        invite_status: "delivery_failed",
      },
    });

    await expect(
      prisma.waitlist.findUnique({ where: { id: waitlistId }, select: { status: true } }),
    ).resolves.toEqual({ status: "approved" });

    const failedInvitation = await prisma.authToken.findFirst({
      where: { email, type: "waitlist_invite" },
      orderBy: { createdAt: "desc" },
      select: { usedAt: true },
    });
    expect(failedInvitation?.usedAt).not.toBeNull();
  });

  test("a failed resend preserves an older active invitation", async ({ request }) => {
    const priorInvitation = await prisma.authToken.create({
      data: {
        email,
        type: "waitlist_invite",
        tokenHash: crypto.randomBytes(32).toString("hex"),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await request.patch(`/api/admin/waitlist/${waitlistId}`, {
      headers: { "x-admin-token": adminToken },
      data: { action: "resend_invite" },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      emailSent: false,
      data: {
        invite_status: "active",
        latest_delivery_status: "skipped",
      },
    });

    await expect(
      prisma.authToken.findUnique({
        where: { id: priorInvitation.id },
        select: { usedAt: true },
      }),
    ).resolves.toEqual({ usedAt: null });
  });

  test("the admin list exposes invitation and registration state", async ({ request }) => {
    const response = await request.get(`/api/admin/waitlist?search=${encodeURIComponent(email)}`, {
      headers: { "x-admin-token": adminToken },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      total: 1,
      data: [
        {
          id: waitlistId,
          email,
          status: "approved",
          registered: false,
          invite_status: "active",
          latest_delivery_status: "skipped",
        },
      ],
    });
  });

  test("revocation invalidates active invitations", async ({ request }) => {
    const response = await request.patch(`/api/admin/waitlist/${waitlistId}`, {
      headers: { "x-admin-token": adminToken },
      data: { status: "pending" },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { status: "pending", invite_status: "not_sent" },
    });

    await expect(
      prisma.authToken.count({
        where: { email, type: "waitlist_invite", usedAt: null },
      }),
    ).resolves.toBe(0);
  });

  test("registered users are visible and cannot be revoked", async ({ request }) => {
    await prisma.user.create({
      data: {
        email,
        name: "Waitlist Integration Test",
        passwordHash: "not-a-real-password-hash",
      },
    });

    const listResponse = await request.get(`/api/admin/waitlist?search=${encodeURIComponent(email)}`, {
      headers: { "x-admin-token": adminToken },
    });
    expect(listResponse.status()).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      data: [
        {
          email,
          registered: true,
          invite_status: "registered",
        },
      ],
    });

    const revokeResponse = await request.patch(`/api/admin/waitlist/${waitlistId}`, {
      headers: { "x-admin-token": adminToken },
      data: { status: "pending" },
    });
    expect(revokeResponse.status()).toBe(409);
    await expect(revokeResponse.json()).resolves.toMatchObject({
      success: false,
      message: "A registered account cannot be revoked from the waitlist.",
    });
  });
});
