import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { checkServerIdentity } from "node:tls";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let prismaInstance: PrismaClient;

if (globalForPrisma.prisma) {
  prismaInstance = globalForPrisma.prisma;
} else {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      // Route modules are evaluated while Next.js builds, but dynamic handlers
      // do not query the database. Keep credentials out of image build args;
      // runtime still fails closed when DATABASE_URL is absent.
      connectionString = "postgresql://build:build@127.0.0.1:5432/build";
    } else {
      throw new Error("DATABASE_URL environment variable is missing.");
    }
  }
  
  // The pg Pool receives TLS configuration explicitly below. Remove URL-level
  // SSL options because pg-connection-string otherwise replaces that object,
  // which breaks hostname verification when an SSM tunnel uses localhost.
  const parsedConnectionString = new URL(connectionString);
  for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) {
    parsedConnectionString.searchParams.delete(parameter);
  }
  connectionString = parsedConnectionString.toString();

  const sslDisabled = process.env.DATABASE_SSL === "disable";
  const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
  const rejectUnauthorized =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" ||
    (process.env.NODE_ENV === "production" && process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false");

  const pool = new Pool({
    connectionString,
    max: Number.parseInt(process.env.DATABASE_POOL_MAX || "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: sslDisabled
      ? false
      : {
          rejectUnauthorized,
          ...(sslServerName
            ? {
                checkServerIdentity: (_hostname: string, certificate: Parameters<typeof checkServerIdentity>[1]) =>
                  checkServerIdentity(sslServerName, certificate),
              }
            : {}),
        },
  });

  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }
}

export const prisma = prismaInstance;
