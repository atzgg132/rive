import nextEnv from "@next/env";
import { checkServerIdentity } from "node:tls";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const parsed = new URL(process.env.DATABASE_URL);
for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsed.searchParams.delete(parameter);
const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
const pool = new Pool({
  connectionString: parsed.toString(),
  max: 2,
  ssl: process.env.DATABASE_SSL === "disable"
    ? false
    : {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
        ...(sslServerName ? { checkServerIdentity: (_hostname, certificate) => checkServerIdentity(sslServerName, certificate) } : {}),
      },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const users = await prisma.user.findMany({ where: { email: { startsWith: "contract-smoke-" } }, select: { id: true } });
  for (const user of users) {
    await prisma.contract.deleteMany({ where: { userId: user.id } });
    await prisma.invoice.deleteMany({ where: { userId: user.id } });
    await prisma.project.deleteMany({ where: { userId: user.id } });
    await prisma.client.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  console.log(`Removed ${users.length} interrupted contract smoke fixture(s).`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
