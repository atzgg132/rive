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
    ssl: {
      rejectUnauthorized: false
    }
  });

  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }
}

export const prisma = prismaInstance;

// Mock functions for legacy raw SQL compatibility
export function getDbPool(): any {
  return {};
}
export async function initDbSchema(pool: any) {
  return;
}
