import "server-only";

import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { googleCalendarAvailable } from "@/utils/connectorConfig";
import { pushEventToGoogle } from "@/utils/googleCalendar";

/**
 * How long a claimed row may stay "processing" before another worker treats
 * the claim as dead. Claims run inside a request with a ~25s budget and a
 * 15s outbound fetch cap, so 75s is generous without leaving rows stuck.
 */
export const CALENDAR_SYNC_LEASE_MS = 75_000;
export const CALENDAR_SYNC_MAX_ATTEMPTS = 8;
/**
 * The EventBridge job runner's HTTP timeout is 25s. The cron worker stops
 * claiming well before that so the response lands and no row is abandoned in
 * "processing" mid-run.
 */
export const CALENDAR_SYNC_DEADLINE_MS = 15_000;

const VALID_OPERATIONS = new Set(["create", "update", "delete"]);

export type CalendarSyncOperation = "create" | "update" | "delete";

/**
 * `lastResult` vocabulary written onto each row:
 * - `completed`          — the provider accepted the push.
 * - `missing_event`      — the event (or a usable job payload) is gone; skipped.
 * - `unsupported`        — a provider/operation this worker cannot push; skipped.
 * - `no_destination`     — no writable Google calendar resolved for the event
 *                          (skipped for update/delete, retryable for create).
 * - `provider_not_ready` — create couldn't push: the connector is off or no
 *                          Google connection is currently "connected"; retryable.
 * - `error`              — the push threw; pending while attempts remain,
 *                          failed at the cap.
 * - `attempt_cap`        — a stale claimed row hit the attempt cap; failed.
 */

export type CalendarSyncRunResult = {
  /** Rows this run actually claimed via the atomic updateMany (not selected). */
  claimed: number;
  /** Rows the provider accepted. */
  completed: number;
  /** Rows resolved without a push — nothing existed remotely to change. */
  skipped: number;
  /** Rows returned to pending for a later attempt. */
  retried: number;
  /** Rows that reached a terminal failure this run. */
  failed: number;
  /** Stale claimed rows recovered back to pending. */
  reclaimed: number;
};

type CalendarSyncClient = Pick<
  typeof prisma,
  "calendarSyncOutbox" | "calendarEvent" | "calendarConnection"
>;

export type ProcessCalendarSyncOptions = {
  limit?: number;
  /** Process only this job (the events route's immediate-sync path). */
  jobId?: string;
  /** Stop claiming new work once this much wall time has passed. */
  deadlineMs?: number;
  now?: Date;
  push?: (eventId: string, operation: CalendarSyncOperation) => Promise<boolean>;
  client?: CalendarSyncClient;
};

function retryDelayMs(attemptsAfterClaim: number): number {
  return Math.min(6 * 60 * 60 * 1000, 2 ** attemptsAfterClaim * 30_000);
}

export async function enqueueCalendarSync(
  userId: string,
  eventId: string,
  operation: CalendarSyncOperation,
  client: Pick<typeof prisma, "calendarSyncOutbox"> = prisma,
): Promise<string> {
  const job = await client.calendarSyncOutbox.create({
    data: { userId, eventId, operation, provider: "google" },
    select: { id: true },
  });
  return job.id;
}

/**
 * A create that returns false is retryable, but the reason matters:
 * `provider_not_ready` when the connector is off or the user has no
 * "connected" Google account (a reconnect will unblock it), `no_destination`
 * when a connected account exists but no writable calendar could be resolved.
 */
async function falseCreateReason(
  client: CalendarSyncClient,
  userId: string,
): Promise<"provider_not_ready" | "no_destination"> {
  if (!googleCalendarAvailable()) return "provider_not_ready";
  const connection = await client.calendarConnection.findFirst({
    where: { userId, provider: "google", status: "connected" },
    select: { id: true },
  });
  return connection ? "no_destination" : "provider_not_ready";
}

/**
 * Drain the calendar sync outbox.
 *
 * Claims are atomic (`updateMany` guarded by the current status) and carry a
 * lease: `claimedAt`, a unique `leaseId`, and `leaseExpiresAt`. Settlement is
 * guarded by the leaseId so a worker that overran its lease cannot clobber a
 * row a fresh worker already reclaimed. Every update that moves a row out of
 * "processing" clears the lease fields.
 *
 * The events route calls this with `jobId` for immediate sync — a false push
 * there leaves the row pending for the cron worker instead of being marked
 * completed.
 */
export async function processCalendarSyncOutbox(
  options: ProcessCalendarSyncOptions = {},
): Promise<CalendarSyncRunResult> {
  const client = options.client ?? prisma;
  const push = options.push ?? pushEventToGoogle;
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const startedAt = Date.now();
  const staleBefore = new Date(now.getTime() - CALENDAR_SYNC_LEASE_MS);

  // Rows stuck in "processing" past their lease (or claimed before leases
  // existed, so only claimedAt/createdAt can age them) belong to a dead worker.
  const staleProcessingWhere = {
    status: "processing",
    OR: [
      { leaseExpiresAt: { lte: now } },
      { leaseExpiresAt: null, claimedAt: { lte: staleBefore } },
      { leaseExpiresAt: null, claimedAt: null, createdAt: { lte: staleBefore } },
    ],
  };
  const leaseCleared = { claimedAt: null, leaseId: null, leaseExpiresAt: null };
  // Under the attempt cap the row goes back to pending and can be claimed
  // again immediately; at the cap it fails terminally instead of looping.
  const reclaimed = await client.calendarSyncOutbox.updateMany({
    where: { ...staleProcessingWhere, attempts: { lt: CALENDAR_SYNC_MAX_ATTEMPTS } },
    data: { status: "pending", ...leaseCleared },
  });
  const expiredClaims = await client.calendarSyncOutbox.updateMany({
    where: { ...staleProcessingWhere, attempts: { gte: CALENDAR_SYNC_MAX_ATTEMPTS } },
    data: {
      status: "failed",
      processedAt: now,
      lastResult: "attempt_cap",
      lastError: "The sync claim expired before the job could finish.",
      ...leaseCleared,
    },
  });

  const jobs = await client.calendarSyncOutbox.findMany({
    where: {
      ...(options.jobId ? { id: options.jobId } : {}),
      status: "pending",
      availableAt: { lte: now },
      attempts: { lt: CALENDAR_SYNC_MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: options.jobId ? 1 : limit,
  });

  let claimed = 0;
  let completed = 0;
  let skipped = 0;
  let retried = 0;
  let failed = expiredClaims.count;

  for (const job of jobs) {
    if (options.deadlineMs !== undefined && claimed > 0 && Date.now() - startedAt >= options.deadlineMs) {
      break;
    }

    const claimedAt = new Date();
    const leaseId = crypto.randomUUID();
    const claim = await client.calendarSyncOutbox.updateMany({
      where: { id: job.id, status: "pending" },
      data: {
        status: "processing",
        attempts: { increment: 1 },
        claimedAt,
        leaseId,
        leaseExpiresAt: new Date(claimedAt.getTime() + CALENDAR_SYNC_LEASE_MS),
      },
    });
    if (claim.count !== 1) continue;
    claimed += 1;
    const attemptsAfterClaim = job.attempts + 1;

    // Terminal/queued settlement, guarded by the lease this claim holds. A
    // count of 0 means the lease was lost to a reclaim — the row now belongs
    // to another worker, so the outcome is not ours to record.
    const settle = (data: Prisma.CalendarSyncOutboxUpdateManyMutationInput) =>
      client.calendarSyncOutbox.updateMany({
        where: { id: job.id, leaseId },
        data: { ...leaseCleared, ...data },
      });

    if (job.provider !== "google" || !job.eventId || !VALID_OPERATIONS.has(job.operation)) {
      const result = await settle({
        status: "skipped",
        processedAt: new Date(),
        lastResult: "unsupported",
        lastError: "This sync job is not a Google create/update/delete push.",
      });
      if (result.count === 1) skipped += 1;
      continue;
    }

    try {
      const pushed = await push(job.eventId, job.operation as CalendarSyncOperation);
      if (pushed === true) {
        const result = await settle({
          status: "completed",
          processedAt: new Date(),
          lastError: null,
          lastResult: "completed",
        });
        if (result.count === 1) completed += 1;
        continue;
      }

      // pushEventToGoogle returned false: nothing was pushed and nothing threw.
      const event = await client.calendarEvent.findUnique({
        where: { id: job.eventId },
        select: { id: true, userId: true },
      });
      if (!event) {
        const result = await settle({
          status: "skipped",
          processedAt: new Date(),
          lastResult: "missing_event",
          lastError: "The event no longer exists.",
        });
        if (result.count === 1) skipped += 1;
        continue;
      }
      // Update/delete have nothing remote to change without a Google mapping —
      // the job is done, not failed. A create stays retryable: the destination
      // may appear when the user connects or finishes discovery.
      if (job.operation !== "create") {
        const result = await settle({
          status: "skipped",
          processedAt: new Date(),
          lastResult: "no_destination",
          lastError: "No Google calendar mapping exists for this event.",
        });
        if (result.count === 1) skipped += 1;
        continue;
      }
      const reason = await falseCreateReason(client, event.userId);
      if (attemptsAfterClaim >= CALENDAR_SYNC_MAX_ATTEMPTS) {
        const result = await settle({
          status: "failed",
          processedAt: new Date(),
          lastResult: reason,
          lastError: "The event was never pushed to Google before the attempt cap.",
        });
        if (result.count === 1) failed += 1;
        continue;
      }
      const result = await settle({
        status: "pending",
        availableAt: new Date(Date.now() + retryDelayMs(attemptsAfterClaim)),
        lastResult: reason,
        lastError:
          reason === "provider_not_ready"
            ? "No connected Google account can accept the push yet."
            : "No writable Google calendar destination was found.",
      });
      if (result.count === 1) retried += 1;
    } catch (error) {
      const message = (error instanceof Error ? error.message : "Calendar sync failed.").slice(0, 500);
      if (attemptsAfterClaim >= CALENDAR_SYNC_MAX_ATTEMPTS) {
        const result = await settle({
          status: "failed",
          processedAt: new Date(),
          lastResult: "error",
          lastError: message,
        });
        if (result.count === 1) failed += 1;
      } else {
        const result = await settle({
          status: "pending",
          availableAt: new Date(Date.now() + retryDelayMs(attemptsAfterClaim)),
          lastResult: "error",
          lastError: message,
        });
        if (result.count === 1) retried += 1;
      }
    }
  }

  return { claimed, completed, skipped, retried, failed, reclaimed: reclaimed.count };
}

/**
 * Keyset-paginate a Prisma query ordered by ascending id. `fetchPage` must
 * apply `take` and, once `afterId` is set, restrict to rows with `id > afterId`.
 * Used where a fixed `take: 100` would silently ignore everything past the
 * first page (e.g. the webhook-maintenance sweep over selected calendars).
 */
export async function collectIdPages<T extends { id: string }>(
  pageSize: number,
  fetchPage: (page: { take: number; afterId?: string }) => Promise<T[]>,
): Promise<T[]> {
  const collected: T[] = [];
  let afterId: string | undefined;
  for (;;) {
    const page = await fetchPage({ take: pageSize, afterId });
    collected.push(...page);
    if (page.length < pageSize) break;
    afterId = page[page.length - 1].id;
  }
  return collected;
}
