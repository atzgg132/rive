/**
 * The migration compiler.
 *
 * Runs the whole deterministic pipeline in memory:
 *
 *   profile → classify → map → normalize → relate → dedupe → validate → plan
 *
 * It touches no database and performs no I/O, which is what makes the entire
 * engine testable without Postgres and keeps the server layer to persistence
 * and authorization. Re-running it over the same inputs always produces the
 * same plan hash.
 */

import {
  profileTable,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./profile.ts";
import {
  classifySource,
  manualClassification,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./classify.ts";
import {
  buildMappingPlan,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./mapping.ts";
import {
  buildRecords,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./build.ts";
import {
  deriveImpliedClients,
  resolveRelationships,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./relationships.ts";
import {
  applyDeduplication,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./dedupe.ts";
import {
  validateRecords,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./validate.ts";
import {
  buildImportPlan,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./plan.ts";
import {
  buildWorkspaceIndex,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./workspace.ts";
import {
  resolveHintIndex,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./adapters/registry.ts";
import type { WorkspaceSnapshot } from "./workspace.ts";
import type { DayFirstPreference } from "./normalize/date.ts";
import type { ValueMappings } from "./build.ts";
import type {
  ClassificationResult,
  ImportPlan,
  MappingPlan,
  MigrationEntity,
  MigrationRecordIR,
  SourceClassification,
  SourceProfile,
} from "./types.ts";
import type { SourceTable } from "./parse/table.ts";

/** User decisions carried across re-runs so review work is never lost. */
export type SourceOverrides = {
  /** Record type the user chose when classification was unsure. */
  classification?: SourceClassification;
  /** Column header → canonical field key, or null to ignore the column. */
  mappings?: Record<string, string | null>;
  /** Column header → confirmed date reading. */
  datePreferences?: Record<string, DayFirstPreference>;
  /** Raw source value → canonical value, applied to every row that used it. */
  valueMappings?: ValueMappings;
};

/**
 * A decision the user made about one record during review.
 *
 * `create` keeps a suspected duplicate as its own record, `merge` accepts the
 * suggested match, `skip` leaves the row out entirely, and `link` attaches an
 * unresolved relationship to a specific target.
 */
export type RecordResolution =
  | { decision: "create" }
  | { decision: "skip" }
  | { decision: "merge" }
  | { decision: "link"; existingId?: string; groupKey?: string };

export type PipelineSource = {
  /** Stable across re-uploads of the same bytes; part of every sourceKey. */
  sourceId: string;
  table: SourceTable;
  overrides?: SourceOverrides;
};

export type PipelineInput = {
  sources: readonly PipelineSource[];
  workspace: WorkspaceSnapshot;
  /** Currency the user picked for this migration, if any. */
  migrationDefaultCurrency?: string | null;
  /** Review decisions, keyed by record sourceKey. Replayed on every re-run. */
  resolutions?: Record<string, RecordResolution>;
  planVersion: number;
};

export type AnalyzedSource = {
  sourceId: string;
  profile: SourceProfile;
  classification: ClassificationResult;
  /** Null when the source could not be classified into a single entity. */
  mappingPlan: MappingPlan | null;
  recordCount: number;
};

export type PipelineResult = {
  sources: AnalyzedSource[];
  records: MigrationRecordIR[];
  plan: ImportPlan;
  /** Sources needing a decision before they contribute anything. */
  unclassified: Array<{ sourceId: string; fileName: string; sheetName: string | null; reason: string }>;
};

export function runPipeline(input: PipelineInput): PipelineResult {
  const workspaceIndex = buildWorkspaceIndex(input.workspace);
  const analyzed: AnalyzedSource[] = [];
  const unclassified: PipelineResult["unclassified"] = [];
  const records: MigrationRecordIR[] = [];
  let autoMapped = 0;
  let totalMappable = 0;

  for (const source of input.sources) {
    const profile = profileTable(source.table, source.sourceId);
    const override = source.overrides?.classification;
    const classification = override ? manualClassification(override) : classifySource(profile);

    if (!isEntity(classification.classification)) {
      analyzed.push({ sourceId: source.sourceId, profile, classification, mappingPlan: null, recordCount: 0 });
      unclassified.push({
        sourceId: source.sourceId,
        fileName: source.table.fileName,
        sheetName: source.table.sheetName,
        reason: classification.reason,
      });
      continue;
    }

    const entity = classification.classification;
    const mappingPlan = buildMappingPlan(
      profile,
      entity,
      resolveHintIndex(profile),
      source.overrides?.mappings || {},
    );
    autoMapped += mappingPlan.autoMappedCount;
    totalMappable += mappingPlan.totalMappableColumns;

    const built = buildRecords(source.table, mappingPlan, entity, {
      sourceId: source.sourceId,
      currency: {
        sourceCurrency: null,
        migrationDefault: input.migrationDefaultCurrency || null,
        workspaceDefault: input.workspace.defaultCurrency,
      },
      datePreferences: source.overrides?.datePreferences,
      valueMappings: source.overrides?.valueMappings,
    });
    records.push(...built);
    analyzed.push({ sourceId: source.sourceId, profile, classification, mappingPlan, recordCount: built.length });
  }

  // Relationships are resolved only once every source has been read, which is
  // what makes upload order irrelevant.
  const resolution = resolveRelationships(records, workspaceIndex);

  // A migration of invoices alone can still reconstruct its clients.
  const implied = deriveImpliedClients(records, resolution);
  if (implied.length) {
    records.push(...implied);
    // Re-resolve so invoices and projects attach to the clients just derived.
    const second = resolveRelationships(records, workspaceIndex);
    applyDeduplication(records, second.index, workspaceIndex);
  } else {
    applyDeduplication(records, resolution.index, workspaceIndex);
  }

  validateRecords(records);

  // The user's decisions are applied last so they override anything the engine
  // inferred, and are re-applied on every run so review work is never lost when
  // the pipeline recomputes.
  applyResolutions(records, input.resolutions || {});

  const plan = buildImportPlan({
    records,
    mappingStats: { autoMapped, totalMappable },
    planVersion: input.planVersion,
  });

  return { sources: analyzed, records, plan, unclassified };
}

function isEntity(value: SourceClassification): value is MigrationEntity {
  return value !== "unknown" && value !== "mixed";
}

/**
 * Apply review decisions to the staged records.
 *
 * A record that still carries a validation error is left alone: the user
 * choosing "keep both" cannot make an invalid amount valid, and silently
 * importing it would break the promise that blocked rows do not get written.
 */
function applyResolutions(records: MigrationRecordIR[], resolutions: Record<string, RecordResolution>): void {
  if (!Object.keys(resolutions).length) return;

  for (const record of records) {
    const resolution = resolutions[record.source.sourceKey];
    if (!resolution || record.errors.length) continue;

    switch (resolution.decision) {
      case "create":
        record.action = "create";
        record.status = "ready";
        break;
      case "skip":
        record.action = "skip";
        record.status = "skipped";
        break;
      case "merge": {
        // Accept the strongest suggested duplicate. Against an existing
        // workspace record this becomes a link; within the upload the row is
        // folded into the record it duplicates.
        const candidate = record.duplicateCandidates[0];
        if (!candidate) break;
        if (candidate.scope === "workspace" && candidate.targetId) {
          record.action = "link";
          record.status = "ready";
        } else {
          record.action = "skip";
          record.status = "skipped";
        }
        break;
      }
      case "link": {
        const field = record.entity === "expenses" ? "projectId" : "clientId";
        record.resolvedRelationships[field] = {
          groupKey: resolution.groupKey || null,
          existingId: resolution.existingId || null,
          confidence: 1,
        };
        // Answering the relationship question clears the review item, so the
        // record stops asking once the user has told it the answer.
        record.relationshipCandidates = [];
        if (record.status === "review") record.status = "ready";
        break;
      }
      default:
        break;
    }
  }
}
