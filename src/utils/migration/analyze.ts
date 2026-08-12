import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { MIGRATION_ENGINE_VERSION } from "@/lib/migration/config";
import { describeColumn } from "@/lib/migration/profile";
import { runPipeline, type PipelineSource, type RecordResolution, type SourceOverrides } from "@/lib/migration/pipeline";
import type { SourceTable } from "@/lib/migration/parse/table";
import type { ImportPlan, MigrationRecordIR, MigrationState } from "@/lib/migration/types";
import type { WorkspaceSnapshot } from "@/lib/migration/workspace";
import { MIGRATION_EVENTS, recordMigrationEvent } from "@/utils/migration/analytics";
import { phaseFor } from "@/utils/migration/session";
import type { IngestedSource } from "@/utils/migration/ingest";

/**
 * Analysis: persist sources, run the deterministic pipeline, store the result.
 *
 * The pipeline itself is pure. This module is only responsible for reading the
 * workspace, writing the intermediate representation, and moving the session
 * state — which is what lets the whole engine be tested without a database.
 */

/** How much of the workspace to compare against. */
const WORKSPACE_SCAN_LIMIT = 5_000;

/**
 * Load what already exists so migration can link rather than duplicate.
 *
 * Every query is scoped by `userId`. The migration engine has no other way to
 * reach workspace data, so tenant isolation is enforced at this single point.
 */
export async function loadWorkspaceSnapshot(userId: string): Promise<WorkspaceSnapshot> {
  const [user, clients, projects, invoices, expenses] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { currency: true } }),
    prisma.client.findMany({
      where: { userId },
      select: { id: true, name: true, email: true, phone: true, company: true, website: true },
      take: WORKSPACE_SCAN_LIMIT,
    }),
    prisma.project.findMany({
      where: { userId },
      select: { id: true, title: true, clientId: true },
      take: WORKSPACE_SCAN_LIMIT,
    }),
    prisma.invoice.findMany({
      where: { userId },
      select: { id: true, invoiceNumber: true, clientId: true, total: true, issueDate: true },
      take: WORKSPACE_SCAN_LIMIT,
    }),
    prisma.expense.findMany({
      where: { userId },
      select: { id: true, description: true, amount: true, date: true },
      take: WORKSPACE_SCAN_LIMIT,
    }),
  ]);

  return {
    defaultCurrency: user?.currency || "USD",
    clients,
    projects,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      total: Number(invoice.total),
      issueDate: toDateOnly(invoice.issueDate),
    })),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      description: expense.description,
      amount: Number(expense.amount),
      date: toDateOnly(expense.date),
    })),
  };
}

/** Dates are stored at UTC midnight; read them back the same way. */
function toDateOnly(value: Date | null): string | null {
  if (!value) return null;
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

/** Persist newly uploaded sources onto an existing migration. */
export async function persistSources(importJobId: string, sources: IngestedSource[]): Promise<void> {
  for (const source of sources) {
    const { table } = source;
    const payload = {
      name: source.fileName,
      mimeType: source.mimeType,
      sizeBytes: source.sizeBytes,
      checksum: source.checksum,
      entity: "unknown",
      rowCount: table.rows.length,
      headers: table.headers as unknown as Prisma.InputJsonValue,
      sample: table.rows.slice(0, 5) as unknown as Prisma.InputJsonValue,
      rows: table.rows as unknown as Prisma.InputJsonValue,
      sheetName: table.sheetName,
      encoding: table.encoding,
      delimiter: table.delimiter,
      headerRow: table.headerRowIndex,
    };
    // Re-uploading the same bytes replaces the source rather than adding a
    // second copy; `sourceId` makes that deterministic.
    await prisma.importFile.upsert({
      where: { importJobId_sourceId: { importJobId, sourceId: source.sourceId } },
      create: { importJobId, sourceId: source.sourceId, ...payload },
      update: payload,
    });
  }
}

type StoredFile = {
  id: string;
  sourceId: string | null;
  name: string;
  sheetName: string | null;
  encoding: string | null;
  delimiter: string | null;
  headerRow: number;
  headers: Prisma.JsonValue;
  rows: Prisma.JsonValue;
  overrides: Prisma.JsonValue;
};

function toSourceTable(file: StoredFile): SourceTable {
  return {
    fileName: file.name,
    sheetName: file.sheetName,
    headers: Array.isArray(file.headers) ? (file.headers as string[]) : [],
    rows: Array.isArray(file.rows) ? (file.rows as string[][]) : [],
    headerRowIndex: file.headerRow,
    blankRowCount: 0,
    encoding: file.encoding || "utf-8",
    delimiter: file.delimiter,
  };
}

export type AnalysisResult = {
  plan: ImportPlan;
  state: MigrationState;
  recordCount: number;
};

/**
 * Re-run the full pipeline for a migration and persist everything it produced.
 *
 * This is called after the first upload and again after any user edit. It is
 * deliberately a full recompute rather than an incremental patch: relationships
 * and duplicates are global properties of the whole upload, so a partial
 * re-analysis could leave the plan internally inconsistent.
 */
export async function analyzeMigration(userId: string, importJobId: string): Promise<AnalysisResult> {
  const job = await prisma.importJob.findFirstOrThrow({
    where: { id: importJobId, userId },
    include: { files: { orderBy: { createdAt: "asc" } } },
  });

  const workspace = await loadWorkspaceSnapshot(userId);
  const sources: PipelineSource[] = job.files
    .filter((file) => file.sourceId)
    .map((file) => ({
      sourceId: file.sourceId as string,
      table: toSourceTable(file),
      overrides: (file.overrides as SourceOverrides | null) || undefined,
    }));

  // Review decisions live on the migration and are replayed on every run, so a
  // recompute triggered by one edit never discards answers to other questions.
  const summary = (job.summary as Record<string, unknown> | null) || {};
  const resolutions = (summary.resolutions as Record<string, RecordResolution> | undefined) || {};

  const result = runPipeline({
    sources,
    workspace,
    migrationDefaultCurrency: job.defaultCurrency,
    resolutions,
    planVersion: job.planVersion + 1,
  });

  const filesBySourceId = new Map(job.files.map((file) => [file.sourceId, file]));

  // Replace the staged IR wholesale. Rewriting is safe because nothing has been
  // committed yet; once operations exist, re-analysis is refused upstream.
  await prisma.$transaction(async (transaction) => {
    await transaction.migrationRecord.deleteMany({ where: { importJobId } });

    for (const analyzed of result.sources) {
      const file = filesBySourceId.get(analyzed.sourceId);
      if (!file) continue;
      await transaction.importFile.update({
        where: { id: file.id },
        data: {
          entity: analyzed.classification.classification,
          confidence: analyzed.classification.confidence,
          reason: analyzed.classification.reason,
          profile: {
            columns: analyzed.profile.columns.map((column) => ({
              header: column.header,
              inferredType: column.inferredType,
              nullPercentage: column.nullPercentage,
              uniquePercentage: column.uniquePercentage,
              exampleValues: column.exampleValues,
              description: describeColumn(column),
            })),
          } as unknown as Prisma.InputJsonValue,
          mapping: (analyzed.mappingPlan?.mappings || []) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    if (result.records.length) {
      await transaction.migrationRecord.createMany({
        data: result.records.map((record) => toRecordRow(importJobId, record, filesBySourceId)),
      });
    }

    await transaction.importJob.update({
      where: { id: importJobId },
      data: {
        status: nextState(result.plan, result.unclassified.length),
        phase: phaseFor(nextState(result.plan, result.unclassified.length)),
        planHash: result.plan.planHash,
        planVersion: result.plan.planVersion,
        plan: result.plan as unknown as Prisma.InputJsonValue,
        totalRows: sources.reduce((sum, source) => sum + source.table.rows.length, 0),
        processedRows: result.records.length,
        unresolvedCount: result.plan.reviewItems.length + result.unclassified.length,
        summary: {
          ...summary,
          // Resolutions are carried forward explicitly. Overwriting `summary`
          // wholesale here would silently discard every review decision the
          // user has made so far.
          resolutions,
          metrics: result.plan.metrics,
          counts: result.plan.counts,
          totals: result.plan.totals,
          unclassified: result.unclassified,
        } as unknown as Prisma.InputJsonValue,
        error: null,
      },
    });
  }, { timeout: 60_000 });

  await Promise.all([
    recordMigrationEvent(userId, MIGRATION_EVENTS.mappingGenerated, importJobId, {
      fileCount: sources.length,
      recordCount: result.records.length,
      autoMappingRate: result.plan.metrics.autoMappingRate,
      relationshipResolutionRate: result.plan.metrics.relationshipResolutionRate,
      migrationVersion: MIGRATION_ENGINE_VERSION,
    }),
    recordMigrationEvent(userId, MIGRATION_EVENTS.planCreated, importJobId, {
      recordCount: result.plan.operations.length,
      reviewCount: result.plan.reviewItems.length,
      errorCount: result.plan.metrics.errorCount,
      warningCount: result.plan.metrics.warningCount,
      duplicateRate: result.plan.metrics.duplicateRate,
      entityCounts: {
        clients: result.plan.counts.clients.create,
        projects: result.plan.counts.projects.create,
        invoices: result.plan.counts.invoices.create,
        expenses: result.plan.counts.expenses.create,
      },
    }),
  ]);

  return {
    plan: result.plan,
    state: nextState(result.plan, result.unclassified.length),
    recordCount: result.records.length,
  };
}

/**
 * A migration is only `ready` when nothing needs a person. Anything that would
 * require the user to accept a guess keeps it in `review_required`.
 */
function nextState(plan: ImportPlan, unclassifiedCount: number): MigrationState {
  if (unclassifiedCount > 0 || plan.reviewItems.length > 0 || plan.blocked.length > 0) return "review_required";
  return "ready";
}

function toRecordRow(
  importJobId: string,
  record: MigrationRecordIR,
  filesBySourceId: Map<string | null, { id: string }>,
): Prisma.MigrationRecordCreateManyInput {
  return {
    importJobId,
    importFileId: filesBySourceId.get(record.source.sourceId)?.id || null,
    entity: record.entity,
    sourceRow: record.source.sourceRow,
    sourceKey: record.source.sourceKey,
    externalId: record.source.externalId,
    raw: record.raw as unknown as Prisma.InputJsonValue,
    normalized: record.normalized as unknown as Prisma.InputJsonValue,
    fieldMappings: record.fieldMappings as unknown as Prisma.InputJsonValue,
    confidence: record.confidence,
    warnings: record.warnings as unknown as Prisma.InputJsonValue,
    errors: record.errors as unknown as Prisma.InputJsonValue,
    relationshipCandidates: record.relationshipCandidates as unknown as Prisma.InputJsonValue,
    resolvedRelationships: record.resolvedRelationships as unknown as Prisma.InputJsonValue,
    duplicateCandidates: record.duplicateCandidates as unknown as Prisma.InputJsonValue,
    groupKey: record.groupKey,
    status: record.status,
    action: record.action,
  };
}
