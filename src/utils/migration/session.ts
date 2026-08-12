import "server-only";

import { prisma } from "@/utils/db";
import { canTransition, isEditable, isResumable, isTerminal, phaseFor } from "@/lib/migration/state";
import type { MigrationState } from "@/lib/migration/types";

/**
 * Migration session persistence.
 *
 * The state machine itself lives in `@/lib/migration/state` so it can be tested
 * exhaustively without a database. This module adds the two things that need a
 * server: ownership-scoped reads, and transitions that are safe under
 * concurrency.
 *
 * Every transition is decided here. The client can ask for an action ("analyze",
 * "commit"); it can never assert a state. That matters because state is what
 * authorises destructive work — a client that could claim `ready` could skip
 * review entirely.
 */

export { canTransition, isEditable, isResumable, isTerminal, phaseFor };

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
 * The expected state is part of the `updateMany` filter, so two concurrent
 * requests cannot both believe they won: the second matches zero rows and is
 * told the migration has moved on.
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
