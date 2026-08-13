/**
 * Import plan construction and hashing.
 *
 * The plan is the contract between preview and commit. It names every
 * operation that will run, in order, and carries a hash of its own contents.
 * Commit quotes the hash back; if anything about the source, the mapping, or a
 * user resolution has changed since, the hash no longer matches and the commit
 * is refused rather than executing something the user never saw.
 */

import { createHash } from "node:crypto";

import {
  MIGRATION_ENGINE_VERSION,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./config.ts";
import {
  recordLabel,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./validate.ts";
import {
  MIGRATION_ENTITIES,
  type ImportPlan,
  type ImportPlanCounts,
  type MigrationEntity,
  type MigrationRecordIR,
  type PlannedOperation,
  type RecordAction,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./types.ts";

/**
 * Commit order. Clients first so projects can attach to them, projects before
 * invoices and expenses so those can attach in turn. Getting this wrong would
 * silently drop relationships.
 */
const COMMIT_ORDER: MigrationEntity[] = ["clients", "projects", "invoices", "expenses"];

export type PlanInput = {
  records: readonly MigrationRecordIR[];
  /** Mapping statistics, needed for the auto-resolution metric. */
  mappingStats: { autoMapped: number; totalMappable: number };
  planVersion: number;
};

function emptyCounts(): ImportPlanCounts {
  return MIGRATION_ENTITIES.reduce((counts, entity) => {
    counts[entity] = { create: 0, link: 0, skip: 0, review: 0 };
    return counts;
  }, {} as ImportPlanCounts);
}

/**
 * The operation a record's action implies.
 *
 * A record awaiting review still produces a concrete operation, because the
 * plan must state exactly what happens if the user proceeds without changing
 * anything. The safe default for an unconfirmed duplicate is to create it
 * separately: that is non-destructive and can be rolled back, whereas merging
 * cannot be undone.
 */
function operationFor(record: MigrationRecordIR): { action: RecordAction; reason: string } | null {
  switch (record.action) {
    case "create":
      return { action: "create", reason: "New record from your files." };
    case "link": {
      const duplicate = record.duplicateCandidates.find((candidate) => candidate.scope === "workspace");
      return {
        action: "link",
        reason: duplicate
          ? `Linked to the existing "${duplicate.label}" instead of creating a second one.`
          : "Linked to a record that already exists in Rive.",
      };
    }
    case "review":
      return { action: "create", reason: "Created separately unless you choose to merge or skip it." };
    case "skip":
    case "merge":
    default:
      return null;
  }
}

function reviewKind(record: MigrationRecordIR): { kind: ImportPlan["reviewItems"][number]["kind"]; message: string; suggestions: Array<{ label: string; value: string }> } | null {
  if (record.action === "review" && record.duplicateCandidates.length) {
    const candidate = record.duplicateCandidates[0];
    return {
      kind: "duplicate",
      message: `This looks like "${candidate.label}" — ${candidate.evidence[0]}.`,
      suggestions: [
        { label: "Keep both", value: "create" },
        { label: candidate.scope === "workspace" ? "Use the existing record" : "Merge them", value: "merge" },
        { label: "Skip this row", value: "skip" },
      ],
    };
  }

  // Candidates only exist for relationships that did *not* resolve, so their
  // presence is exactly the condition for asking. Checking
  // `resolvedRelationships` here as well would wrongly stay silent about an
  // unresolved client on an invoice whose project happened to resolve.
  if (record.relationshipCandidates.length) {
    const candidate = record.relationshipCandidates[0];
    return {
      kind: "relationship",
      message: `Rive is not sure which client this belongs to. "${candidate.label}" is the closest match — ${candidate.evidence[0]}.`,
      suggestions: record.relationshipCandidates.slice(0, 3).map((item) => ({
        label: item.label,
        value: item.existingId ? `existing:${item.existingId}` : `group:${item.groupKey}`,
      })),
    };
  }

  const decisive = record.warnings.find((warning) =>
    warning.code === "CURRENCY_AMBIGUOUS" || warning.code === "STATUS_UNKNOWN" || warning.code === "DATE_AMBIGUOUS",
  );
  if (decisive) {
    return {
      kind: decisive.code === "CURRENCY_AMBIGUOUS" ? "currency" : decisive.code === "DATE_AMBIGUOUS" ? "date" : "status",
      message: decisive.message,
      suggestions: decisive.suggestions || [],
    };
  }
  return null;
}

export function buildImportPlan(input: PlanInput): ImportPlan {
  const counts = emptyCounts();
  const operations: PlannedOperation[] = [];
  const reviewItems: ImportPlan["reviewItems"] = [];
  const blocked: ImportPlan["blocked"] = [];

  const ordered = [...input.records].sort((a, b) => {
    const entityDelta = COMMIT_ORDER.indexOf(a.entity) - COMMIT_ORDER.indexOf(b.entity);
    if (entityDelta !== 0) return entityDelta;
    return a.source.sourceKey.localeCompare(b.source.sourceKey);
  });

  let warningCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  let relationshipsNeeded = 0;
  let relationshipsResolved = 0;

  for (const record of ordered) {
    warningCount += record.warnings.length;
    errorCount += record.errors.length;
    if (record.duplicateCandidates.length) duplicateCount += 1;

    if (record.entity === "projects" || record.entity === "invoices") {
      const wantsClient = Boolean(record.normalized.clientRef || record.normalized.clientEmailRef);
      if (wantsClient) {
        relationshipsNeeded += 1;
        if (record.resolvedRelationships.clientId) relationshipsResolved += 1;
      }
    }
    if (record.entity === "invoices" || record.entity === "expenses") {
      if (record.normalized.projectRef) {
        relationshipsNeeded += 1;
        if (record.resolvedRelationships.projectId) relationshipsResolved += 1;
      }
    }

    if (record.status === "error") {
      counts[record.entity].skip += 1;
      blocked.push({
        sourceKey: record.source.sourceKey,
        entity: record.entity,
        label: recordLabel(record),
        message: record.errors[0]?.message || "This record cannot be imported.",
      });
      continue;
    }

    const review = reviewKind(record);
    if (review) {
      counts[record.entity].review += 1;
      reviewItems.push({
        sourceKey: record.source.sourceKey,
        entity: record.entity,
        label: recordLabel(record),
        kind: review.kind,
        message: review.message,
        suggestions: review.suggestions,
      });
    }

    const operation = operationFor(record);
    if (!operation) {
      counts[record.entity].skip += 1;
      continue;
    }
    if (operation.action === "create") counts[record.entity].create += 1;
    if (operation.action === "link") counts[record.entity].link += 1;

    operations.push({
      operationKey: `${record.entity}:${record.source.sourceKey}`,
      sequence: operations.length,
      action: operation.action,
      entity: record.entity,
      sourceKey: record.source.sourceKey,
      label: recordLabel(record),
      existingId: record.duplicateCandidates.find((candidate) => candidate.scope === "workspace")?.targetId || null,
      reason: operation.reason,
      payloadHash: hashPayload(record),
    });
  }

  const totals = MIGRATION_ENTITIES.reduce(
    (accumulator, entity) => ({
      create: accumulator.create + counts[entity].create,
      link: accumulator.link + counts[entity].link,
      skip: accumulator.skip + counts[entity].skip,
      review: accumulator.review + counts[entity].review,
      error: accumulator.error,
    }),
    { create: 0, link: 0, skip: 0, review: 0, error: blocked.length },
  );

  const body = {
    engineVersion: MIGRATION_ENGINE_VERSION,
    planVersion: input.planVersion,
    counts,
    totals,
    operations,
    reviewItems,
    blocked,
  };

  return {
    ...body,
    // `createdAt` is deliberately outside the hash: regenerating an identical
    // plan a minute later must produce the same hash, or resuming a migration
    // would look like a change the user never made.
    createdAt: new Date().toISOString(),
    planHash: hashPlanBody(body),
    metrics: {
      autoMappingRate: ratio(input.mappingStats.autoMapped, input.mappingStats.totalMappable),
      relationshipResolutionRate: ratio(relationshipsResolved, relationshipsNeeded),
      duplicateRate: ratio(duplicateCount, input.records.length),
      warningCount,
      errorCount,
    },
  };
}

function ratio(part: number, total: number): number {
  if (total <= 0) return 1;
  return Math.round((part / total) * 1000) / 1000;
}

/**
 * Hash over the plan's decisions only.
 *
 * Key order is fixed by construction and operations are already in a
 * deterministic sequence, so identical inputs hash identically across
 * processes — which is what makes the preview-to-commit guarantee real rather
 * than best effort.
 */
export function hashPlanBody(body: Omit<ImportPlan, "planHash" | "createdAt" | "metrics">): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

/**
 * Fingerprint of the values one operation will write.
 *
 * Object keys are sorted so two runs that populated `normalized` in a different
 * order still agree — otherwise the plan hash would change for reasons the user
 * never caused.
 */
export function hashPayload(record: MigrationRecordIR): string {
  const normalized = Object.keys(record.normalized)
    .sort()
    .map((key) => [key, record.normalized[key]] as const);
  const relationships = Object.keys(record.resolvedRelationships)
    .sort()
    .map((key) => [key, record.resolvedRelationships[key]] as const);
  return createHash("sha256")
    .update(JSON.stringify({ entity: record.entity, normalized, relationships }))
    .digest("hex")
    .slice(0, 16);
}

/** True when a plan still describes the current state of the migration. */
export function planMatches(plan: ImportPlan, expectedHash: string): boolean {
  return plan.planHash === expectedHash;
}
