import "server-only";

import { enqueueMigrationWork, type MigrationWorkMessage } from "@/utils/migration/queue";
import { processMigrationWork } from "@/utils/migration/worker";

type DispatchInput = Omit<MigrationWorkMessage, "version" | "environment">;

/** Queue in hosted environments; execute through the same worker locally. */
export async function dispatchMigrationWork(input: DispatchInput) {
  const queued = await enqueueMigrationWork(input);
  if (queued) return { queued: true as const, outcome: null };
  const outcome = await processMigrationWork({
    version: 1,
    environment: (process.env.APP_ENV || "local").toLowerCase(),
    ...input,
  });
  return { queued: false as const, outcome };
}
