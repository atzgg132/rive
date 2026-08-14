/**
 * Short-lived request idempotency guard.
 *
 * Contract creation has no natural unique key, so a double-click or a retry
 * after a dropped response can create a duplicate draft. A client-supplied
 * request id with a short dedupe window turns that into a single creation:
 * the second request with the same (user, requestId) within the window is
 * told it already succeeded and handed back the original result.
 *
 * This is a process-local fallback, matching the rate limiter in rateLimit.ts.
 * It is deliberately scoped as a cosmetic/cleanup guard — drafts are not
 * accepted legal records, so a lost dedupe under a process restart is
 * acceptable — and is not a substitute for a durable unique key once
 * Agreements become legally significant records.
 */

type IdempotencyEntry = {
  createdAt: number;
  result: { contractId: string; versionId: string };
};

const entries = new Map<string, IdempotencyEntry>();

const DEFAULT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 5_000;

/** Return the stored result for (user, requestId), if still in-window. */
export function readIdempotentResult(
  userId: string,
  requestId: string,
  windowMs: number = DEFAULT_WINDOW_MS,
): { contractId: string; versionId: string } | null {
  const entry = entries.get(`${userId}:${requestId}`);
  if (!entry) return null;
  if (Date.now() - entry.createdAt >= windowMs) {
    entries.delete(`${userId}:${requestId}`);
    return null;
  }
  return entry.result;
}

/** Store the result of a completed creation for later dedupe. */
export function recordIdempotentResult(
  userId: string,
  requestId: string,
  result: { contractId: string; versionId: string },
  windowMs: number = DEFAULT_WINDOW_MS,
): void {
  const now = Date.now();
  const key = `${userId}:${requestId}`;
  entries.set(key, { createdAt: now, result });

  // Best-effort sweep so a long-lived process can't accumulate forever.
  if (entries.size > MAX_ENTRIES) {
    for (const [entryKey, entry] of entries) {
      if (now - entry.createdAt >= windowMs) entries.delete(entryKey);
    }
  }
}
