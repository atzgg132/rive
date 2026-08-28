import assert from "node:assert/strict";
import test from "node:test";

import { countsAsNativeDeadline } from "../../src/utils/funnelDefinitions.ts";

test("a project created in the activation window counts as a deadline if it has any due date", () => {
  assert.equal(countsAsNativeDeadline({ dueDate: new Date("2026-09-30T00:00:00.000Z") }), true);
  assert.equal(countsAsNativeDeadline({ dueDate: "2026-09-30" }), true);
  assert.equal(countsAsNativeDeadline({ dueDate: null }), false);
  assert.equal(countsAsNativeDeadline({ dueDate: undefined }), false);
});
