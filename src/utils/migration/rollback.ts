import "server-only";

/**
 * Compatibility surface for historical imports.
 *
 * Migration rollback is disabled by policy. Imported records and migration
 * history are retained; callers should mark unfinished jobs abandoned instead.
 * The API routes return a bounded 410 response and do not call this module.
 */
export type RollbackConflict = never;

export type RollbackOutcome = {
  ok: false;
  deleted: Record<string, never>;
  conflicts: never[];
  message: string;
};

const disabledOutcome: RollbackOutcome = {
  ok: false,
  deleted: {},
  conflicts: [],
  message: "Migration rollback is disabled. Imported records are never removed.",
};

export async function previewRollback(): Promise<RollbackOutcome> {
  return disabledOutcome;
}

export async function executeRollback(): Promise<RollbackOutcome> {
  return disabledOutcome;
}
