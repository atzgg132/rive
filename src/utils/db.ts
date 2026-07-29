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
    throw new Error("DATABASE_URL environment variable is missing.");
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
        },
  });

  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }
}

export const prisma = prismaInstance;
