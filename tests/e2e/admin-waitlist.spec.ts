import { checkServerIdentity } from "node:tls";
import { PrismaPg } from "@prisma/adapter-pg";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

test.describe("legacy waitlist archive", () => {
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
        : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true", ...(sslServerName ? { checkServerIdentity: (_hostname: string, certificate: Parameters<typeof checkServerIdentity>[1]) => checkServerIdentity(sslServerName, certificate) } : {}) },
    });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    adminToken = generateToken();
    const entry = await prisma.waitlist.create({ data: { email, type: "waitlist" } });
    waitlistId = entry.id;
  });

  test.afterAll(async () => {
    if (!prisma || !waitlistId) return;
    await prisma.auditEvent.deleteMany({ where: { targetType: "waitlist", targetId: String(waitlistId) } });
    await prisma.emailDelivery.deleteMany({ where: { recipient: email } });
    await prisma.authToken.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.waitlist.deleteMany({ where: { id: waitlistId } });
    await prisma.$disconnect();
  });

  test("legacy detail endpoint is readable", async ({ request }) => {
    const response = await request.get(`/api/admin/waitlist/${waitlistId}`, { headers: { "x-admin-token": adminToken } });
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { id: waitlistId, email, status: "pending" } });
  });

  test("legacy mutations are refused and do not create invitations", async ({ request }) => {
    const response = await request.patch(`/api/admin/waitlist/${waitlistId}`, { headers: { "x-admin-token": adminToken }, data: { status: "approved" } });
    expect(response.status()).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "LEGACY_WAITLIST_READ_ONLY" });
    await expect(prisma.waitlist.findUnique({ where: { id: waitlistId }, select: { status: true } })).resolves.toEqual({ status: "pending" });
    await expect(prisma.authToken.count({ where: { email, type: "waitlist_invite" } })).resolves.toBe(0);
  });

  test("the archive list preserves historical registration state", async ({ request }) => {
    const response = await request.get(`/api/admin/waitlist?search=${encodeURIComponent(email)}`, { headers: { "x-admin-token": adminToken } });
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, total: 1, data: [{ id: waitlistId, email, status: "pending", registered: false }] });
  });
});
