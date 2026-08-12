import "server-only";

import { prisma } from "@/utils/db";
import type { MigrationState } from "@/lib/migration/types";

/**
 * Migration session state.
 *
 * Every transition is decided here, on the server. The client can ask for an
 * action ("analyze", "commit"); it can never assert a state. That matters
 * because state is what authorises destructive work: if a client could claim
 * `ready`, it could skip review entirely.
 */

/** Allowed transitions. Anything absent is rejected. */
const TRANSITIONS: Record<MigrationState, MigrationState[]> = {
  created: ["uploading", "failed"],
  uploading: ["profiling", "failed"],
  profiling: ["mapping", "review_required", "ready", "failed"],
  mapping: ["review_required", "ready", "failed"],
  // Re-analysis after a user edit can move a migration in either direction.
  review_required: ["profiling", "mapping", "review_required", "ready", "committing", "failed"],
  ready: ["profiling", "mapping", "review_required", "ready", "committing", "failed"],
  // A commit that dies mid-flight stays committing until it is resumed or
  // explicitly failed; it must never silently fall back to ready.
  committing: ["completed", "completed_with_issues", "failed", "committing"],
  completed: ["rolled_back"],
  completed_with_issues: ["rolled_back"],
  failed: ["profiling", "mapping", "review_required", "ready", "committing"],
  rolled_back: [],
};

export function canTransition(from: MigrationState, to: MigrationState): boolean {
  return (TRANSITIONS[from] || []).includes(to);
}

/** States in which mappings, classifications, and resolutions may be edited. */
export function isEditable(state: MigrationState): boolean {
  return ["created", "uploading", "profiling", "mapping", "review_required", "ready", "failed"].includes(state);
}

export function isTerminal(state: MigrationState): boolean {
  return ["completed", "completed_with_issues", "rolled_back"].includes(state);
}

export type MigrationSessionSummary = {
  id: string;
  state: MigrationState;
  planHash: string | null;
  planVersion: number;
  defaultCurrency: string | null;
  engineVersion: number;
};

/**
 * Load a migration for a user.
 *
 * Ownership is part of the query rather than a check afterwards, so there is no
 * code path that reads another tenant's migration and then decides what to do.
 */
export async function loadSession(userId: string, id: string) {
  return prisma.importJob.findFirst({
    where: { id, userId, engineVersion: 2 },
    include: { files: { orderBy: { createdAt: "asc" } } },
  });
}

/**
 * Move a migration to a new state, refusing invalid transitions.
 *
 * The state is included in the `updateMany` filter so two concurrent requests
 * cannot both believe they won: the second matches zero rows and is told the
 * migration moved on.
 */
export async function transition(
  id: string,
  userId: string,
  from: MigrationState[],
  to: MigrationState,
  data: Record<string, unknown> = {},
): Promise<boolean> {
  const allowed = from.filter((state) => canTransition(state, to));
  if (!allowed.length) return false;
  const result = await prisma.importJob.updateMany({
    where: { id, userId, status: { in: allowed } },
    data: { status: to, ...data },
  });
  return result.count > 0;
}

/** The phase label the existing import history UI reads. */
export function phaseFor(state: MigrationState): string {
  if (["created", "uploading", "profiling"].includes(state)) return "analysis";
  if (["mapping", "review_required", "ready"].includes(state)) return "review";
  if (state === "committing") return "commit";
  if (state === "rolled_back") return "rollback";
  return "reconciliation";
}
