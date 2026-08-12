import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";

/**
 * Migration product analytics.
 *
 * Events are append-only and carry dimensions but never customer data: a
 * property may be a count, a rate, a duration, or an entity name, never a cell
 * value, a client name, or a file's contents.
 */
export const MIGRATION_EVENTS = {
  started: "migration_started",
  filesUploaded: "migration_files_uploaded",
  fileProfiled: "migration_file_profiled",
  sourceClassified: "migration_source_classified",
  mappingGenerated: "migration_mapping_generated",
  manualMappingUsed: "migration_manual_mapping_used",
  reviewStarted: "migration_review_started",
  issueResolved: "migration_issue_resolved",
  planCreated: "migration_plan_created",
  commitStarted: "migration_commit_started",
  completed: "migration_completed",
  failed: "migration_failed",
  rolledBack: "migration_rolled_back",
} as const;

export type MigrationEventName = (typeof MIGRATION_EVENTS)[keyof typeof MIGRATION_EVENTS];

/**
 * Dimensions the funnel is measured on.
 *
 * `autoMappingRate` and `relationshipResolutionRate` together answer the
 * question that matters most for this feature: what share of the work did the
 * user not have to do by hand?
 */
export type MigrationEventProperties = {
  fileCount?: number;
  recordCount?: number;
  entityCounts?: Record<string, number>;
  autoMappingRate?: number;
  manualMappingCount?: number;
  relationshipResolutionRate?: number;
  duplicateRate?: number;
  errorCount?: number;
  warningCount?: number;
  reviewCount?: number;
  /** Milliseconds. */
  durationMs?: number;
  /** Milliseconds from migration start to a completed commit. */
  timeToImportMs?: number;
  sourceType?: string;
  migrationVersion?: number;
  entity?: string;
  classification?: string;
  confidence?: number;
  outcome?: string;
  reason?: string;
};

/**
 * Record one migration event.
 *
 * Analytics must never break a migration, so every failure here is swallowed
 * after logging. A lost event is an acceptable cost; a failed import is not.
 */
export async function recordMigrationEvent(
  userId: string,
  event: MigrationEventName,
  importJobId: string | null,
  properties: MigrationEventProperties = {},
): Promise<void> {
  try {
    await prisma.migrationEvent.create({
      data: {
        userId,
        importJobId,
        event,
        properties: properties as Prisma.InputJsonObject,
      },
    });
  } catch (error) {
    console.error("Migration analytics event could not be recorded:", error);
  }
}
