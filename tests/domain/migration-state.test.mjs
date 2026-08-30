import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedTransitions,
  canTransition,
  isEditable,
  isResumable,
  isTerminal,
  phaseFor,
} from "../../src/lib/migration/state.ts";
import { MIGRATION_STATES } from "../../src/lib/migration/types.ts";

test("every state is present in the transition table", () => {
  for (const state of MIGRATION_STATES) {
    assert.ok(Array.isArray(allowedTransitions(state)), `${state} has no transitions defined`);
  }
});
test("a commit can only start from a reviewed migration", () => {
  assert.equal(canTransition("ready", "committing"), true);
  assert.equal(canTransition("review_required", "committing"), true);
  assert.equal(canTransition("failed", "committing"), true, "a failed commit may be resumed");

  assert.equal(canTransition("created", "committing"), false);
  assert.equal(canTransition("uploading", "committing"), false);
  assert.equal(canTransition("profiling", "committing"), false);
  assert.equal(canTransition("completed", "committing"), false);
  assert.equal(canTransition("rolled_back", "committing"), false);
});

test("a commit in flight can never fall back to ready", () => {
  // Otherwise a crashed commit would look like one that never started, and a
  // retry would run the same operations a second time.
  assert.equal(canTransition("committing", "ready"), false);
  assert.equal(canTransition("committing", "review_required"), false);
  assert.equal(canTransition("committing", "completed"), true);
  assert.equal(canTransition("committing", "completed_with_issues"), true);
  assert.equal(canTransition("committing", "failed"), true);
  assert.equal(canTransition("committing", "committing"), true, "resuming is allowed");
});

test("a rolled back migration is final", () => {
  assert.deepEqual([...allowedTransitions("rolled_back")], []);
  for (const state of MIGRATION_STATES) {
    assert.equal(canTransition("rolled_back", state), false, `rolled_back must not reach ${state}`);
  }
});

test("no current migration can transition into the historical rolled-back state", () => {
  for (const state of MIGRATION_STATES) {
    assert.equal(canTransition(state, "rolled_back"), false, `${state} must not transition to rolled_back`);
  }
});

test("a migration stops being editable once it has been imported", () => {
  assert.equal(isEditable("review_required"), true);
  assert.equal(isEditable("ready"), true);
  assert.equal(isEditable("failed"), true);
  assert.equal(isEditable("committing"), false);
  assert.equal(isEditable("completed"), false);
  assert.equal(isEditable("rolled_back"), false);
});

test("terminal and resumable states do not overlap", () => {
  for (const state of MIGRATION_STATES) {
    assert.equal(isTerminal(state) && isResumable(state), false, `${state} cannot be both`);
  }
  assert.equal(isTerminal("completed"), true);
  assert.equal(isResumable("review_required"), true);
});

test("phase labels stay compatible with the existing import history", () => {
  assert.equal(phaseFor("profiling"), "analysis");
  assert.equal(phaseFor("review_required"), "review");
  assert.equal(phaseFor("committing"), "commit");
  assert.equal(phaseFor("rolled_back"), "rollback");
  assert.equal(phaseFor("completed"), "reconciliation");
});
