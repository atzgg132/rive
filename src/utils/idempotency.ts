/**
 * Durable request idempotency backed by the `idempotency_records` table.
 *
 * A client-supplied key turns a double-click or a retry after a dropped
 * response into one side effect instead of a duplicate record:
 *
 * - The first request with a (user, operation, key) triple creates a
 *   `processing` row *before* any side effect runs. The unique
 *   (userId, operation, keyHash) constraint is the lock — concurrent
 *   claimants race that row, never a business table like product_events.
 * - Keys are hashed (SHA-256) rather than stored raw, and the canonical
 *   request payload is hashed too. The same key under a different payload is
 *   an explicit conflict — never a silent replay of unrelated work.
 * - A `processing` row answers a typed in-progress result so a concurrent
 *   duplicate waits/retries instead of running the side effect twice.
 * - A `completed` row replays the JSON response stored with it, so the retried
 *   caller receives exactly what the original attempt produced.
 * - A `failed` row may be retried safely with the same payload: the retry
 *   reclaims the row and runs again.
 * - An expired row is ignored logically — reclaimed in place (never deleted),
 *   so history survives while a new attempt proceeds.
 *
 * Keys are never silently truncated: an absent key skips idempotency, but a
 * supplied key that is empty, non-string, or over 128 characters is rejected
 * outright.
 */

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";

export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
/** Records stay replayable for a day; after that a retry executes fresh. */
export const IDEMPOTENCY_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
export const IDEMPOTENCY_PROCESSING_STALE_MS = 10 * 60 * 1000;

export class InvalidIdempotencyKeyError extends Error {
  readonly code = "invalid_idempotency_key";

  constructor(message: string) {
    super(message);
    this.name = "InvalidIdempotencyKeyError";
  }
}

/**
 * Normalize a client-supplied idempotency key. Absent input means "no
 * idempotency requested" and returns null; a present-but-unusable key throws
 * rather than being truncated or coerced into a collision-prone value.
 */
export function normalizeIdempotencyKey(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") {
    throw new InvalidIdempotencyKeyError("The Idempotency-Key must be text.");
  }
  const key = raw.trim();
  if (!key) {
    throw new InvalidIdempotencyKeyError("The Idempotency-Key must not be empty.");
  }
  if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new InvalidIdempotencyKeyError(`The Idempotency-Key must be ${IDEMPOTENCY_KEY_MAX_LENGTH} characters or fewer.`);
  }
  return key;
}

/**
 * Canonical JSON text: object keys sorted, `undefined` entries dropped, array
 * order preserved. Two semantically identical payloads hash identically even
 * when their key order or whitespace differs on the wire.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** SHA-256 over the canonical payload — the request fingerprint. */
export function hashRequestPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(payload ?? null)).digest("hex");
}

function hashIdempotencyKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export type IdempotencyClaim =
  | { kind: "claimed"; recordId: string; claimedAt: Date }
  | { kind: "replay"; httpStatus: number; body: unknown }
  | { kind: "in_progress" }
  | { kind: "conflict" };

type IdempotencyClient = Pick<typeof prisma, "idempotencyRecord">;

type StoredRecord = {
  id: string;
  requestHash: string;
  status: string;
  response: unknown;
  expiresAt: Date;
  updatedAt: Date;
};

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

function replayFromResponse(response: unknown): { httpStatus: number; body: unknown } | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  const stored = response as { status?: unknown; body?: unknown };
  if (typeof stored.status !== "number" || !("body" in stored)) return null;
  return { httpStatus: stored.status, body: stored.body };
}

/**
 * Reclaim an expired or failed row in place. The optimistic `updatedAt`
 * predicate serializes concurrent reclaimers: exactly one wins and proceeds;
 * the rest re-read and answer from whatever the winner left behind.
 */
async function reclaimRecord(
  client: IdempotencyClient,
  record: StoredRecord,
  requestHash: string,
  expiresAt: Date,
  ttlMs: number,
): Promise<IdempotencyClaim> {
  const reclaimed = await client.idempotencyRecord.updateMany({
    where: { id: record.id, updatedAt: record.updatedAt },
    data: {
      status: "processing",
      requestHash,
      response: Prisma.DbNull,
      entityType: null,
      entityId: null,
      expiresAt,
    },
  });
  if (reclaimed.count === 1) {
    // Re-read so the fencing timestamp is the one actually stored. Nothing
    // else can move the row in between: it is now fresh `processing`.
    const fresh = await client.idempotencyRecord.findUnique({ where: { id: record.id } });
    if (!fresh) return { kind: "in_progress" };
    return { kind: "claimed", recordId: record.id, claimedAt: (fresh as StoredRecord).updatedAt };
  }
  const fresh = await client.idempotencyRecord.findUnique({ where: { id: record.id } });
  if (!fresh) return { kind: "in_progress" };
  return evaluateExisting(client, fresh as StoredRecord, requestHash, ttlMs);
}

async function evaluateExisting(
  client: IdempotencyClient,
  record: StoredRecord,
  requestHash: string,
  ttlMs: number = IDEMPOTENCY_DEFAULT_TTL_MS,
): Promise<IdempotencyClaim> {
  // An expired row is ignored logically: whatever it recorded no longer
  // counts, and the unique slot is reclaimed for this attempt.
  if (record.expiresAt.getTime() <= Date.now()) {
    return reclaimRecord(client, record, requestHash, new Date(Date.now() + ttlMs), ttlMs);
  }
  if (record.requestHash !== requestHash) return { kind: "conflict" };
  if (record.status === "completed") {
    const replay = replayFromResponse(record.response);
    // A completed row without a readable response is an inconsistency we
    // refuse to guess at: better an explicit conflict than a fabricated replay.
    return replay ? { kind: "replay", ...replay } : { kind: "conflict" };
  }
  if (record.status === "failed") {
    return reclaimRecord(client, record, requestHash, new Date(Date.now() + ttlMs), ttlMs);
  }
  if (record.status === "processing" && record.updatedAt.getTime() <= Date.now() - IDEMPOTENCY_PROCESSING_STALE_MS) {
    return reclaimRecord(client, record, requestHash, new Date(Date.now() + ttlMs), ttlMs);
  }
  return { kind: "in_progress" };
}

/**
 * Claim (userId, operation, key) for execution. The caller decides the
 * requestHash — usually `hashRequestPayload` over the canonical request body,
 * but operations with bespoke intent semantics (like invoice creation) supply
 * their own fingerprint.
 *
 * `waitForCompletionMs` bounds how long a duplicate that finds a healthy
 * `processing` row polls for the winner's receipt before answering
 * `in_progress`. Concurrent double-submits almost always arrive while the
 * first attempt is mid-transaction; a short wait lets them replay the stored
 * response instead of being told to try again. Other outcomes (replay,
 * conflict, a reclaim after failure) resolve on the first evaluation.
 */
export async function claimIdempotencyKey(args: {
  userId: string;
  operation: string;
  key: string;
  requestHash: string;
  ttlMs?: number;
  client?: IdempotencyClient;
  waitForCompletionMs?: number;
}): Promise<IdempotencyClaim> {
  const deadline = Date.now() + (args.waitForCompletionMs ?? 0);
  for (;;) {
    const claim = await evaluateIdempotencyClaim(args);
    if (claim.kind !== "in_progress" || Date.now() >= deadline) return claim;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

async function evaluateIdempotencyClaim(args: {
  userId: string;
  operation: string;
  key: string;
  requestHash: string;
  ttlMs?: number;
  client?: IdempotencyClient;
}): Promise<IdempotencyClaim> {
  const client = args.client ?? prisma;
  const ttlMs = args.ttlMs ?? IDEMPOTENCY_DEFAULT_TTL_MS;
  const keyHash = hashIdempotencyKey(args.key);
  const uniqueWhere = {
    userId_operation_keyHash: { userId: args.userId, operation: args.operation, keyHash },
  } as const;

  const existing = await client.idempotencyRecord.findUnique({ where: uniqueWhere });
  if (existing) return evaluateExisting(client, existing as StoredRecord, args.requestHash, ttlMs);

  try {
    const created = await client.idempotencyRecord.create({
      data: {
        userId: args.userId,
        operation: args.operation,
        keyHash,
        requestHash: args.requestHash,
        status: "processing",
        expiresAt: new Date(Date.now() + ttlMs),
      },
      select: { id: true, updatedAt: true },
    });
    return { kind: "claimed", recordId: created.id, claimedAt: created.updatedAt };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Lost the create race: the winner's row is committed — evaluate it.
    const raced = await client.idempotencyRecord.findUnique({ where: uniqueWhere });
    if (raced) return evaluateExisting(client, raced as StoredRecord, args.requestHash, ttlMs);
    return { kind: "in_progress" };
  }
}

/**
 * Mark a claimed record completed and store the response future retries must
 * replay. Call inside the side-effect transaction so the record, the entity,
 * and its receipt commit — or roll back — together.
 *
 * `claimedAt` is the fencing token — the `updatedAt` value the claimant
 * observed when it won the slot. A claimant whose slot was reclaimed while it
 * was stalled writes nothing, so a stale worker can never overwrite the new
 * claimant's receipt. Returns whether this claimant still held the claim.
 */
export async function completeIdempotencyRecord(
  client: IdempotencyClient,
  recordId: string,
  claimedAt: Date,
  result: { httpStatus: number; body: unknown; entityType?: string; entityId?: string },
): Promise<boolean> {
  const body = JSON.parse(JSON.stringify(result.body ?? null)) as Prisma.InputJsonValue;
  const updated = await client.idempotencyRecord.updateMany({
    where: { id: recordId, updatedAt: claimedAt, status: "processing" },
    data: {
      status: "completed",
      response: { status: result.httpStatus, body },
      entityType: result.entityType ?? null,
      entityId: result.entityId ?? null,
    },
  });
  return updated.count === 1;
}

/**
 * Release a claim whose side effects failed, so the same payload may retry.
 * No-op if the record already moved on (e.g. completed or reclaimed by a
 * racing claimant).
 */
export async function failIdempotencyRecord(recordId: string, claimedAt: Date): Promise<void> {
  await prisma.idempotencyRecord.updateMany({
    where: { id: recordId, updatedAt: claimedAt, status: "processing" },
    data: { status: "failed" },
  });
}

/**
 * Turn a `replay` claim into the stored response. The original status line
 * (a 201, say) belongs to the original request; the replay is a fresh
 * response reporting the earlier result, so it answers 200 with
 * `replayed: true` merged into object bodies.
 */
export function idempotentReplayJson(claim: { httpStatus: number; body: unknown }): NextResponse {
  const body =
    claim.body && typeof claim.body === "object" && !Array.isArray(claim.body)
      ? { ...(claim.body as Record<string, unknown>), replayed: true }
      : claim.body;
  return NextResponse.json(body ?? null, { status: 200 });
}
