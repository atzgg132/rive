/**
 * The migration session state machine.
 *
 * Both are pure so they can be tested exhaustively without a database. The
 * server modules import from here; they add persistence and authorization but
 * never a second copy of these rules.
 */

import type { MigrationState } from "./types.ts";

/**
 * Allowed transitions. Anything absent is rejected.
 *
 * Two properties matter most:
 *   - `committing` cannot fall back to `ready`. A commit that dies mid-flight
 *     stays committing until it is resumed or explicitly failed, so a crash can
 *     never be mistaken for "not started".
 *   - `abandoned` is terminal. An unfinished migration remains retained as
 *     history; imported records are never removed by this engine.
 */
const TRANSITIONS: Record<MigrationState, readonly MigrationState[]> = {
  created: ["uploading", "failed", "abandoned"],
  uploading: ["queued_analysis", "profiling", "failed", "abandoned"],
  queued_analysis: ["queued_analysis", "profiling", "failed", "abandoned"],
  profiling: ["mapping", "review_required", "ready", "failed", "abandoned"],
  mapping: ["queued_analysis", "review_required", "ready", "failed", "abandoned"],
  review_required: ["queued_analysis", "profiling", "mapping", "review_required", "ready", "queued_commit", "committing", "failed", "abandoned"],
  ready: ["queued_analysis", "profiling", "mapping", "review_required", "ready", "queued_commit", "committing", "failed", "abandoned"],
  queued_commit: ["queued_commit", "committing", "failed"],
  committing: ["completed", "completed_with_issues", "failed", "committing"],
  completed: [],
  completed_with_issues: [],
  failed: ["queued_analysis", "profiling", "mapping", "review_required", "ready", "queued_commit", "committing", "abandoned"],
  abandoned: [],
  // Legacy terminal state. Nothing transitions into this anymore — rollback
  // is disabled — but historical rows already in this state must still type
  // check and remain terminal.
  rolled_back: [],
};

/** States in which mappings, classifications, and resolutions may be edited. */
const EDITABLE: readonly MigrationState[] = [
  "created", "uploading", "profiling", "mapping", "review_required", "ready", "failed",
];

const TERMINAL: readonly MigrationState[] = ["completed", "completed_with_issues", "abandoned", "rolled_back"];

/** States from which a user may still return to an unfinished migration. */
const RESUMABLE: readonly MigrationState[] = [
  "created", "uploading", "queued_analysis", "profiling", "mapping", "review_required", "ready", "queued_commit", "committing", "failed",
];

export function canTransition(from: MigrationState, to: MigrationState): boolean {
  return TRANSITIONS[from].includes(to);
}
export function allowedTransitions(from: MigrationState): readonly MigrationState[] {
  return TRANSITIONS[from];
}

export function isEditable(state: MigrationState): boolean {
  return EDITABLE.includes(state);
}

export function isTerminal(state: MigrationState): boolean {
  return TERMINAL.includes(state);
}

export function isResumable(state: MigrationState): boolean {
  return RESUMABLE.includes(state);
}

/** The phase label the existing import history reads. */
export function phaseFor(state: MigrationState): string {
  if (["created", "uploading", "queued_analysis", "profiling"].includes(state)) return "analysis";
  if (["mapping", "review_required", "ready"].includes(state)) return "review";
  if (state === "queued_commit" || state === "committing") return "commit";
  if (state === "abandoned") return "abandoned";
  // Legacy state — see the comment on MIGRATION_STATES. Kept only so rows
  // written before rollback was disabled still display their original label.
  if (state === "rolled_back") return "rollback";
  return "reconciliation";
}
