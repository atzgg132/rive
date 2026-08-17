import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/utils/db";

// Durable fixed-window rate limiter backed by the rate_limit_buckets table.
// Used for public, unauthenticated, enumerable routes (contract sign / review
// tokens) where an in-process Map would reset on every restart and would not
// be shared if the app ever ran more than one instance. The authenticated
// routes keep the in-memory `rateLimit` in src/utils/rateLimit.ts: the app runs
// a single instance, so a restart-reset there is an acceptable, low-value window.

export type DurableRateLimitResult = {
  allowed: boolean;
  /** When the current window frees up. Null when the request was allowed. */
  resetAt: Date | null;
  /** Whole seconds until `resetAt`, at least 1, for a Retry-After header. */
  retryAfterSeconds: number | null;
};

/**
 * Postgres stores these as `timestamp` without a zone, holding UTC. Formatting
 * the bound the same way keeps the comparison inside one time domain rather
 * than depending on the database session's timezone.
 */
function utcStamp(value: Date): string {
  return value.toISOString().slice(0, 23).replace("T", " ");
}

/**
 * As `durableRateLimit`, but reports when a rejected window reopens so the
 * caller can answer with an honest Retry-After instead of a bare 429.
 */
export async function durableRateLimitResult(
  key: string,
  limit: number,
  windowMs: number,
): Promise<DurableRateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  /* One statement, so the whole check is a single atomic operation.
   *
   * The read-then-write version this replaces was race-safe only while a window
   * was already open: concurrent requests arriving at a missing or expired
   * bucket each saw "no window", each ran an upsert that set the count to one,
   * and every one of them was allowed. That is precisely the burst a rate limit
   * exists to stop, and it is the shape an attacker gets for free at the top of
   * every hour.
   *
   * `INSERT ... ON CONFLICT DO UPDATE` takes a row lock on the conflicting row,
   * so concurrent callers are serialized by the database and each one observes
   * the previous caller's increment. The returned count is this request's own
   * position in the window, which makes the cap exact under any concurrency.
   *
   * Requests over the cap still increment. The window is fixed, so `reset_at`
   * does not move and a caller cannot extend their own lockout by retrying. */
  const rows = await prisma.$queryRaw<{ count: number; retry_after: number }[]>(Prisma.sql`
    INSERT INTO "rate_limit_buckets" ("id", "key", "count", "reset_at")
    VALUES (gen_random_uuid(), ${key}, 1, ${utcStamp(resetAt)}::timestamp)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_buckets"."reset_at" <= ${utcStamp(now)}::timestamp THEN 1
        ELSE "rate_limit_buckets"."count" + 1
      END,
      "reset_at" = CASE
        WHEN "rate_limit_buckets"."reset_at" <= ${utcStamp(now)}::timestamp THEN ${utcStamp(resetAt)}::timestamp
        ELSE "rate_limit_buckets"."reset_at"
      END
    RETURNING
      "count"::int AS count,
      CEIL(EXTRACT(EPOCH FROM ("reset_at" - ${utcStamp(now)}::timestamp)))::int AS retry_after
  `);

  const row = rows[0];
  // No row can only mean the statement did not run; fail closed rather than
  // treat an unknown state as headroom.
  if (!row) return { allowed: false, resetAt, retryAfterSeconds: Math.ceil(windowMs / 1000) };

  if (row.count <= limit) return { allowed: true, resetAt: null, retryAfterSeconds: null };

  const retryAfterSeconds = Math.max(1, row.retry_after);
  return { allowed: false, resetAt: new Date(now.getTime() + retryAfterSeconds * 1000), retryAfterSeconds };
}

export async function durableRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  return (await durableRateLimitResult(key, limit, windowMs)).allowed;
}

// Operational cleanup of expired counter rows. Scoped to rate_limit_buckets
// only — it never touches business data. Called from the maintenance cron so
// the table stays bounded without a per-request delete.
export async function pruneExpiredRateLimitBuckets(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const result = await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: cutoff } } });
  return result.count;
}
