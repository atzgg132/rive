import { expect, test } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

test.describe("admin waitlist operations", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!process.env.DATABASE_URL, "A test database is required for waitlist integration checks.");

  const email = `e2e-waitlist-${Date.now()}-${process.pid}@example.com`;
  let prisma: PrismaClient;
  let adminToken: string;
  let waitlistId: number;

  test.beforeAll(async () => {
    const [{ prisma: database }, { generateToken }] = await Promise.all([
      import("../../src/utils/db"),
      import("../../src/utils/auth"),
    ]);
    prisma = database;
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
    const { prepareAuthToken } = await import("../../src/utils/authTokens");
    const prior = prepareAuthToken({ email, type: "waitlist_invite" });
    const priorInvitation = await prisma.authToken.create({ data: prior.data });

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
