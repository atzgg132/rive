import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/utils/db";

// Durable fixed-window rate limiter backed by the rate_limit_buckets table.
// Used for public, unauthenticated, enumerable routes (contract sign / review
// tokens) where an in-process Map would reset on every restart and would not
// be shared if the app ever ran more than one instance. The authenticated
// routes keep the in-memory `rateLimit` in src/utils/rateLimit.ts: the app runs
// a single instance, so a restart-reset there is an acceptable, low-value window.

export async function durableRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const resetAt = new Date(now + windowMs);

  try {
    return await prisma.$transaction(async (tx) => {
      const bucket = await tx.rateLimitBucket.findUnique({ where: { key } });
      // Missing or expired window → (re)start at one. `upsert` is atomic, so a
      // concurrent first-request resolves to a single row.
      if (!bucket || bucket.resetAt.getTime() <= now) {
        await tx.rateLimitBucket.upsert({
          where: { key },
          create: { key, count: 1, resetAt },
          update: { count: 1, resetAt },
        });
        return true;
      }
      if (bucket.count >= limit) return false;
      // Conditional increment: the WHERE is re-checked at update time, so two
      // concurrent requests under the limit cannot both pass the cap.
      const updated = await tx.rateLimitBucket.updateMany({
        where: { key, count: { lt: limit } },
        data: { count: { increment: 1 } },
      });
      return updated.count === 1;
    });
  } catch (error) {
    // A concurrent create raced ahead of the upsert — the winner already
    // started the window at one, so this request may proceed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return true;
    }
    throw error;
  }
}

// Operational cleanup of expired counter rows. Scoped to rate_limit_buckets
// only — it never touches business data. Called from the maintenance cron so
// the table stays bounded without a per-request delete.
export async function pruneExpiredRateLimitBuckets(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const result = await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: cutoff } } });
  return result.count;
}
