import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Mock function for compatibility (no longer needed, but keeps old code imports from throwing errors)
export function getDbPool(): any {
  return {};
}
export async function initDbSchema(pool: any) {
  // Database tables are managed by Prisma ORM via schema.prisma. Bypassing manual init.
  return;
}
