import assert from "node:assert/strict";
import test from "node:test";

import { shouldReplayQueuedPersist } from "../../src/utils/portfolioDraft.ts";

test("a queued persist replays after a failed in-flight save unless there is a conflict", () => {
  assert.equal(shouldReplayQueuedPersist({ status: "published" }, false), true);
  assert.equal(shouldReplayQueuedPersist({ silent: true }, false), true);
  assert.equal(shouldReplayQueuedPersist({ status: "published" }, true), false);
  assert.equal(shouldReplayQueuedPersist(null, false), false);
});
