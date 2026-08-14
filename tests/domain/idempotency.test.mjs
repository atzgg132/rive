import assert from "node:assert/strict";
import test from "node:test";

import { readIdempotentResult, recordIdempotentResult } from "../../src/utils/idempotency.ts";

/**
 * Unit tests for the request idempotency guard used by Agreement creation.
 */

test("a recorded request id is returned as already-handled within the window", () => {
  recordIdempotentResult("user-a", "req-1", { contractId: "c-1", versionId: "v-1" });
  const prior = readIdempotentResult("user-a", "req-1");
  assert.deepEqual(prior, { contractId: "c-1", versionId: "v-1" });
});

test("a different user or a different request id is never deduped", () => {
  recordIdempotentResult("user-a", "req-1", { contractId: "c-1", versionId: "v-1" });
  assert.equal(readIdempotentResult("user-b", "req-1"), null, "cross-user must not match");
  assert.equal(readIdempotentResult("user-a", "req-2"), null, "different request id must not match");
});

test("a request id older than the window is forgotten", async () => {
  recordIdempotentResult("user-a", "req-old", { contractId: "c-1", versionId: "v-1" }, 50);
  // Wait past the window so the entry is genuinely expired.
  await new Promise((resolve) => setTimeout(resolve, 60));
  const expired = readIdempotentResult("user-a", "req-old", 50);
  assert.equal(expired, null, "expired entries must not dedupe");
});

test("an unknown request id is never treated as handled", () => {
  assert.equal(readIdempotentResult("user-a", "never-recorded"), null);
});
