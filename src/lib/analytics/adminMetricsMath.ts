/* Pure helpers behind the admin dashboard numbers. They live outside the
   server-only metrics module so the domain tests can exercise them directly. */

/**
 * Hours from signup to each user's first connected engagement. Only users who
 * signed up after engagement instrumentation began count: an account that
 * predates the flow would report its whole age as "time to engagement", and
 * repeat flows by one user would weight the median toward power users.
 */
export function hoursToFirstEngagement(
  users: Array<{ id: string; createdAt: Date }>,
  createdEvents: Array<{ userId: string | null; occurredAt: Date }>,
  instrumentedSince: Date | null,
): number[] {
  if (!instrumentedSince) return [];
  const signups = new Map(users.filter((user) => user.createdAt >= instrumentedSince).map((user) => [user.id, user.createdAt]));
  const first = new Map<string, Date>();
  for (const event of createdEvents) {
    if (!event.userId || !signups.has(event.userId)) continue;
    const current = first.get(event.userId);
    if (!current || event.occurredAt < current) first.set(event.userId, event.occurredAt);
  }
  return Array.from(first.entries()).map(([userId, occurredAt]) => Math.max(0, (occurredAt.getTime() - signups.get(userId)!.getTime()) / 3_600_000));
}

/** A duration given in hours, in the unit a person would say it in: "under 1m", "14m", "3.5h", "2.1d". */
export function formatHours(hours: number): string {
  const minutes = hours * 60;
  if (minutes < 1) return "under 1m";
  // Round before choosing the unit so 59.9 minutes reads "1h", not "60m".
  if (Math.round(minutes) < 60) return `${Math.round(minutes)}m`;
  if (hours < 48) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

// Trend over the trailing 7 days against the 7 before it. The daily series is
// 14 days long, which is exactly one comparison and no more. A zero prior week
// has no percentage change, but it is still a prior week — the caller says
// "0 in prior 7d" rather than pretending there was nothing to compare.
export function trailingTrend(daily: Array<{ day: string; count: number }>): { current: number; previous: number; change: number | null } {
  const recent = daily.slice(-7).reduce((sum, day) => sum + day.count, 0);
  const prior = daily.slice(-14, -7).reduce((sum, day) => sum + day.count, 0);
  return { current: recent, previous: prior, change: prior > 0 ? Math.round(((recent - prior) / prior) * 1000) / 10 : null };
}

export type ReliabilityCaveat = "stale_events" | "contract_rejects" | "event_scan_truncated" | "uncaptured_source" | "email_failures";

/** The "when not to trust these numbers" notes that currently apply — none when every signal is healthy. */
export function activeReliabilityCaveats(input: {
  alertIds: string[];
  contractRejections24h: number;
  uncapturedSignupRate: number | null;
  failedEmails24h: number;
}): ReliabilityCaveat[] {
  const caveats: ReliabilityCaveat[] = [];
  if (input.alertIds.includes("event_lag_minutes")) caveats.push("stale_events");
  if (input.contractRejections24h > 0) caveats.push("contract_rejects");
  if (input.alertIds.includes("event_scan_truncated")) caveats.push("event_scan_truncated");
  if (input.uncapturedSignupRate !== null && input.uncapturedSignupRate > 5) caveats.push("uncaptured_source");
  if (input.failedEmails24h > 0) caveats.push("email_failures");
  return caveats;
}

/**
 * A TTL cache whose concurrent misses share one in-flight load. Without the
 * shared promise, every request that arrives while the cache is cold starts its
 * own full scan, which is exactly when the database is slowest.
 */
export function createSharedLoader<T>(ttlMs: number, load: () => Promise<T>, now: () => number = Date.now) {
  let cached: { expiresAt: number; value: T } | null = null;
  let inflight: Promise<T> | null = null;
  let generation = 0;
  return {
    get(force = false): Promise<T> {
      if (!force && cached && cached.expiresAt > now()) return Promise.resolve(cached.value);
      if (inflight) return inflight;
      const started = generation;
      const run = load()
        .then((value) => {
          // A clear() during the load means the data changed underneath it;
          // hand this result to its callers but do not cache it.
          if (started === generation) cached = { expiresAt: now() + ttlMs, value };
          return value;
        })
        .finally(() => { if (inflight === run) inflight = null; });
      inflight = run;
      return run;
    },
    peek(): T | null {
      return cached?.value ?? null;
    },
    clear(): void {
      cached = null;
      inflight = null;
      generation += 1;
    },
  };
}
