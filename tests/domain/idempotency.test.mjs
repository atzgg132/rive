import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { prisma } from "../helpers/prisma-mock.mjs";

/**
 * Unit tests for the durable idempotency slice backed by IdempotencyRecord.
 *
 * Runs against the in-memory Prisma mock (the resolution hook substitutes
 * `@/utils/db`), so the (userId, operation, keyHash) unique race and the
 * processing/completed/failed/expired lifecycle are exercised for real —
 * just without Postgres.
 *
 *   node --experimental-strip-types --import ./tests/helpers/module-loader.mjs \
 *        --test tests/domain/idempotency.test.mjs
 */

const {
  claimIdempotencyKey,
  completeIdempotencyRecord,
  failIdempotencyRecord,
  idempotentReplayJson,
  normalizeIdempotencyKey,
  hashRequestPayload,
  stableStringify,
  InvalidIdempotencyKeyError,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_PROCESSING_STALE_MS,
} = await import("../../src/utils/idempotency.ts");

const USER = "user-idem-1";
const OP = "invoice.create";

function claim(overrides = {}) {
  return claimIdempotencyKey({
    userId: USER,
    operation: OP,
    key: "key-1",
    requestHash: hashRequestPayload({ a: 1 }),
    ...overrides,
  });
}

function storedRecord() {
  return prisma.__db.idempotencyRecord[0];
}

beforeEach(() => {
  prisma.__reset();
});

test("an absent key skips idempotency; a usable key is returned trimmed", () => {
  assert.equal(normalizeIdempotencyKey(undefined), null);
  assert.equal(normalizeIdempotencyKey(null), null);
  assert.equal(normalizeIdempotencyKey("  key-abc  "), "key-abc");
});

test("empty and whitespace-only keys are rejected, never silently used", () => {
  for (const bad of ["", "   "]) {
    assert.throws(() => normalizeIdempotencyKey(bad), InvalidIdempotencyKeyError);
  }
});

test("over-length keys are rejected instead of silently truncated", () => {
  const max = "k".repeat(IDEMPOTENCY_KEY_MAX_LENGTH);
  assert.equal(normalizeIdempotencyKey(max), max);
  const tooLong = "k".repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1);
  assert.throws(() => normalizeIdempotencyKey(tooLong), InvalidIdempotencyKeyError);
  // The historical failure mode was slice(0, N) collapsing distinct keys.
  assert.throws(() => normalizeIdempotencyKey(`${max}-tail-that-changes`), InvalidIdempotencyKeyError);
});

test("non-string keys are rejected rather than coerced", () => {
  for (const bad of [42, {}, [], true]) {
    assert.throws(() => normalizeIdempotencyKey(bad), InvalidIdempotencyKeyError);
  }
});

test("stableStringify canonicalizes key order and drops undefined", () => {
  assert.equal(stableStringify({ a: 1, b: { c: 2, d: 3 } }), stableStringify({ b: { d: 3, c: 2 }, a: 1 }));
  assert.equal(stableStringify({ a: 1, b: undefined }), stableStringify({ a: 1 }));
  assert.notEqual(stableStringify([1, 2]), stableStringify([2, 1]), "array order is significant");
});

test("hashRequestPayload fingerprints the canonical payload", () => {
  assert.equal(hashRequestPayload({ a: 1, b: 2 }), hashRequestPayload({ b: 2, a: 1 }));
  assert.notEqual(hashRequestPayload({ a: 1 }), hashRequestPayload({ a: 2 }));
});

test("a first request creates the processing row before side effects", async () => {
  const result = await claim();
  assert.equal(result.kind, "claimed");
  assert.ok(result.recordId);
  assert.ok(result.claimedAt);

  const record = storedRecord();
  assert.equal(record.userId, USER);
  assert.equal(record.operation, OP);
  assert.equal(record.status, "processing");
  assert.equal(record.keyHash.length, 64, "the key is hashed, not stored raw");
  assert.notEqual(record.keyHash, "key-1");
  assert.ok(record.expiresAt.getTime() > Date.now());
});

test("the same key and payload while processing is a typed in-progress, not a duplicate", async () => {
  const first = await claim();
  assert.equal(first.kind, "claimed");

  const second = await claim();
  assert.equal(second.kind, "in_progress");
  assert.equal(prisma.__db.idempotencyRecord.length, 1, "no second record may exist");
});

test("the same key with a different payload is an explicit conflict", async () => {
  assert.equal((await claim()).kind, "claimed");
  const conflict = await claim({ requestHash: hashRequestPayload({ a: 2 }) });
  assert.equal(conflict.kind, "conflict");
});

test("a completed record replays the stored JSON response", async () => {
  const first = await claim();
  await completeIdempotencyRecord(prisma, first.recordId, first.claimedAt, {
    httpStatus: 201,
    body: { success: true, invoice: { id: "inv-1", number: "INV-0001" } },
    entityType: "invoice",
    entityId: "inv-1",
  });

  const replay = await claim();
  assert.equal(replay.kind, "replay");
  assert.equal(replay.httpStatus, 201);
  assert.deepEqual(replay.body, { success: true, invoice: { id: "inv-1", number: "INV-0001" } });

  const response = idempotentReplayJson(replay);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.replayed, true);
  assert.equal(data.invoice.id, "inv-1");

  // A different payload under the same key still conflicts after completion.
  const conflict = await claim({ requestHash: hashRequestPayload({ other: true }) });
  assert.equal(conflict.kind, "conflict");
});

test("a stale processing claim is reclaimed for the same payload", async () => {
  const first = await claim();
  assert.equal(first.kind, "claimed");
  storedRecord().updatedAt = new Date(Date.now() - IDEMPOTENCY_PROCESSING_STALE_MS - 1_000);

  const retry = await claim();
  assert.equal(retry.kind, "claimed");
  assert.equal(retry.recordId, first.recordId);
  assert.notEqual(retry.claimedAt, first.claimedAt, "reclaim rotates the fencing token");
  assert.equal(prisma.__db.idempotencyRecord.length, 1);

  // The stale claimant's fenced writes lose: it cannot overwrite or release
  // the new claimant's row.
  const staleComplete = await completeIdempotencyRecord(prisma, first.recordId, first.claimedAt, {
    httpStatus: 201,
    body: { success: true, invoice: { id: "inv-stale" } },
  });
  assert.equal(staleComplete, false);
  assert.equal(storedRecord().status, "processing");
  await failIdempotencyRecord(first.recordId, first.claimedAt);
  assert.equal(storedRecord().status, "processing", "a stale claimant cannot fail the new claim either");

  storedRecord().updatedAt = new Date(Date.now() - IDEMPOTENCY_PROCESSING_STALE_MS - 1_000);
  const conflict = await claim({ requestHash: hashRequestPayload({ changed: true }) });
  assert.equal(conflict.kind, "conflict", "a stale claim does not let a different payload reuse the key");
});

test("a failed record may be retried safely with the same payload", async () => {
  const first = await claim();
  await failIdempotencyRecord(first.recordId, first.claimedAt);
  assert.equal(storedRecord().status, "failed");

  const retry = await claim();
  assert.equal(retry.kind, "claimed");
  assert.equal(retry.recordId, first.recordId, "the row is reclaimed in place, not duplicated");
  assert.equal(prisma.__db.idempotencyRecord.length, 1);

  await completeIdempotencyRecord(prisma, retry.recordId, retry.claimedAt, {
    httpStatus: 201,
    body: { success: true, invoice: { id: "inv-2" } },
  });
  assert.equal((await claim()).kind, "replay");
});

test("a failed record still conflicts for a different payload", async () => {
  const first = await claim();
  await failIdempotencyRecord(first.recordId, first.claimedAt);
  const conflict = await claim({ requestHash: hashRequestPayload({ changed: true }) });
  assert.equal(conflict.kind, "conflict");
});

test("an expired record is ignored logically and reclaimed, not deleted", async () => {
  const first = await claim({ ttlMs: -1_000 });
  assert.equal(first.kind, "claimed");
  assert.ok(storedRecord().expiresAt.getTime() <= Date.now(), "fixture must already be expired");

  const reclaim = await claim();
  assert.equal(reclaim.kind, "claimed");
  assert.equal(reclaim.recordId, first.recordId, "expiry reclaims the row in place");
  assert.equal(prisma.__db.idempotencyRecord.length, 1, "expired rows are never deleted");
  assert.ok(storedRecord().expiresAt.getTime() > Date.now());

  // An expired row does not even conflict for a different payload.
  const firstExpired = await claim({ key: "key-expired", ttlMs: -1_000 });
  assert.equal(firstExpired.kind, "claimed");
  const differentPayload = await claim({ key: "key-expired", requestHash: hashRequestPayload({ b: 2 }) });
  assert.equal(differentPayload.kind, "claimed");
});

test("losing the optimistic reclaim race answers in-progress instead of duplicating", async () => {
  // Seed an expired row.
  const first = await claim({ ttlMs: -1_000 });
  const recordId = first.recordId;
  const stale = await prisma.idempotencyRecord.findUnique({ where: { id: recordId } });

  // A concurrent claimant reclaims first, bumping updatedAt.
  const winner = await claim();
  assert.equal(winner.kind, "claimed");

  // The stale claimant's guarded write loses: count 0, re-read sees the
  // winner's in-flight processing row, and the answer is in-progress.
  const lost = await prisma.idempotencyRecord.updateMany({
    where: { id: recordId, updatedAt: stale.updatedAt },
    data: { status: "processing" },
  });
  assert.equal(lost.count, 0, "the winner already moved updatedAt");
  assert.equal(storedRecord().status, "processing");
  assert.equal(prisma.__db.idempotencyRecord.length, 1);
});

test("keys are scoped per user and per operation", async () => {
  assert.equal((await claim()).kind, "claimed");
  const otherUser = await claim({ userId: "user-idem-2" });
  assert.equal(otherUser.kind, "claimed", "another tenant's identical key is independent");
  const otherOperation = await claim({ operation: "agreement_draft.create" });
  assert.equal(otherOperation.kind, "claimed");
  assert.equal(prisma.__db.idempotencyRecord.length, 3);
});

test("concurrent claims for a fresh key produce exactly one claimant", async () => {
  const [left, right] = await Promise.all([claim(), claim()]);
  const kinds = [left.kind, right.kind].sort();
  assert.deepEqual(kinds, ["claimed", "in_progress"]);
  assert.equal(prisma.__db.idempotencyRecord.length, 1);
});
