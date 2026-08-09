import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { checkServerIdentity } from "node:tls";

const email = process.env.E2E_USER_EMAIL?.trim().toLowerCase();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("E2E_USER_EMAIL must be a valid email address.");
}

const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
const parsedConnectionString = new URL(process.env.DATABASE_URL);
for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsedConnectionString.searchParams.delete(parameter);
const ssl =
  process.env.DATABASE_SSL === "disable" ||
  process.env.DATABASE_URL.includes("sslmode=disable")
    ? false
    : {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
        ...(sslServerName ? { checkServerIdentity: (_hostname, certificate) => checkServerIdentity(sslServerName, certificate) } : {}),
      };
const pool = new Pool({ connectionString: parsedConnectionString.toString(), ssl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Rive E2E User",
      passwordHash: "e2e-session-authentication-does-not-use-this-password",
      plan: "pro",
      onboardingStatus: "complete",
      onboardingStep: 5,
      businessType: "freelancer",
      profession: "Product designer",
      currency: "USD",
      timeZone: "UTC",
    },
    update: {
      name: "Rive E2E User",
      plan: "pro",
      onboardingStatus: "complete",
      onboardingStep: 5,
    },
  });

  await prisma.calendar.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      userId: user.id,
      name: "Rive",
      timeZone: "UTC",
      isDefault: true,
    },
    update: {
      userId: user.id,
      name: "Rive",
      timeZone: "UTC",
      isDefault: true,
    },
  });

  console.log(`Seeded authenticated E2E user ${email}.`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
