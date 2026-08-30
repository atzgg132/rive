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
  reviewCompleted: "migration_review_completed",
  issueResolved: "migration_issue_resolved",
  planCreated: "migration_plan_created",
  commitStarted: "migration_commit_started",
  completed: "migration_completed",
  failed: "migration_failed",
  abandoned: "migration_abandoned",
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

function safeProperties(properties: MigrationEventProperties): Prisma.InputJsonObject {
  const result: Record<string, Prisma.InputJsonValue> = {};
  for (const key of [
    "fileCount", "recordCount", "autoMappingRate", "manualMappingCount", "relationshipResolutionRate",
    "duplicateRate", "errorCount", "warningCount", "reviewCount", "durationMs", "timeToImportMs",
    "migrationVersion", "confidence",
  ] as const) {
    const value = properties[key];
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  for (const key of ["sourceType", "entity", "classification", "outcome"] as const) {
    const value = properties[key];
    if (typeof value === "string" && /^[a-z0-9_.-]{1,80}$/i.test(value)) result[key] = value;
  }
  if (properties.entityCounts) {
    result.entityCounts = Object.fromEntries(Object.entries(properties.entityCounts)
      .filter(([key, value]) => /^[a-z0-9_-]{1,40}$/i.test(key) && Number.isFinite(value))
      .map(([key, value]) => [key, value]));
  }
  // `reason` is intentionally not persisted. Provider/Prisma messages can
  // contain a filename or source value; failure phase/code live on ImportJob.
  return result as Prisma.InputJsonObject;
}

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
        properties: safeProperties(properties),
      },
    });
  } catch (error) {
    console.error("Migration analytics event could not be recorded:", error);
  }
}
