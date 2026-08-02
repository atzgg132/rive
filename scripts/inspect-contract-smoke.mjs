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
const pool = new Pool({ connectionString: parsed.toString(), max: 2, connectionTimeoutMillis: 10_000, ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true", ...(sslServerName ? { checkServerIdentity: (_hostname, certificate) => checkServerIdentity(sslServerName, certificate) } : {}) } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
try {
  const database = await prisma.$queryRaw`SELECT current_database() AS database, current_user AS user`;
  const totalUsers = await prisma.user.count();
  const users = await prisma.user.findMany({ where: { email: { startsWith: "contract-smoke-" } }, select: { id: true, email: true, name: true } });
  const result = [];
  for (const user of users) {
    const [contracts, links, comments, invoices, activeQueries] = await Promise.all([
      prisma.contract.findMany({ where: { userId: user.id }, select: { id: true, status: true, title: true } }),
      prisma.contractReviewLink.count({ where: { contract: { userId: user.id } } }),
      prisma.contractComment.count({ where: { contract: { userId: user.id } } }),
      prisma.invoice.count({ where: { userId: user.id } }),
      prisma.$queryRaw`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND state <> 'idle'`,
    ]);
    result.push({ id: user.id, email: user.email, contracts, links, comments, invoices, activeQueries });
  }
  console.log(JSON.stringify({ database, totalUsers, smokeUsers: result }));
} finally {
  await prisma.$disconnect();
  await pool.end();
}
