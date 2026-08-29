import { checkServerIdentity } from "node:tls";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const emailArgument = process.argv.find((argument) => argument.startsWith("--email="));
const targetEmail = emailArgument?.slice("--email=".length).trim().toLowerCase();
const shouldApply = process.argv.includes("--apply");

if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
  throw new Error("Pass a valid target with --email=user@example.com.");
}
if (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production") {
  throw new Error("The launch-film cleanup must never run against production.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const parsedConnection = new URL(process.env.DATABASE_URL);
for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsedConnection.searchParams.delete(parameter);
const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
const pool = new Pool({
  connectionString: parsedConnection.toString(),
  ssl: {
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
    ...(sslServerName ? { checkServerIdentity: (_hostname, certificate) => checkServerIdentity(sslServerName, certificate) } : {}),
  },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const user = await prisma.user.findUnique({ where: { email: targetEmail }, select: { id: true, email: true, name: true } });
  if (!user) {
    console.log(JSON.stringify({ mode: shouldApply ? "apply" : "inspect", email: targetEmail, found: false }, null, 2));
  } else if (!shouldApply) {
    console.log(JSON.stringify({ mode: "inspect", found: true, id: user.id, name: user.name }, null, 2));
    console.log("No changes made. Re-run with --apply to delete this account.");
  } else {
    await prisma.user.delete({ where: { id: user.id } });
    console.log(JSON.stringify({ success: true, deleted: true, id: user.id }, null, 2));
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
