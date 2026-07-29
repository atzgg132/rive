import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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
  
  // Strip pg-unsupported query parameters like channel_binding to prevent connection crashes
  connectionString = connectionString.replace(/([?&])channel_binding=[^&]*/g, "$1");
  connectionString = connectionString.replace(/[?&]$/, "");

  const pool = new Pool({
    connectionString,
    max: Number.parseInt(process.env.DATABASE_POOL_MAX || "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: process.env.DATABASE_SSL === "disable"
      ? false
      : {
          rejectUnauthorized:
            process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" ||
            (process.env.NODE_ENV === "production" && process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false"),
          servername: process.env.DATABASE_SSL_SERVERNAME || undefined,
        },
  });

  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }
}

export const prisma = prismaInstance;
