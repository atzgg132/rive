import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { MIGRATION_LIMITS } from "@/lib/migration/config";
import { PROJECT_PRIORITY_SET, PROJECT_STATUS_SET, INVOICE_STATUS_SET, EXPENSE_CATEGORY_SET, CLIENT_STATUS_SET } from "@/lib/domain-vocabulary";
import type { ImportPlan, MigrationEntity } from "@/lib/migration/types";
import { MIGRATION_EVENTS, recordMigrationEvent } from "@/utils/migration/analytics";
import { phaseFor } from "@/utils/migration/session";

/**
 * Commit execution.
 *
 * Three guarantees this module exists to provide:
 *
 * 1. **Idempotency.** Every operation is written to a ledger before anything is
 *    created, and flipped to `applied` inside the same transaction as the
 *    record it creates. A double-click, a retry, or a resumed commit re-reads
 *    the ledger and skips what already happened.
 * 2. **No unknowable half-import.** Work runs in bounded batches, each its own
 *    transaction, rather than one long-running transaction that could time out
 *    with an uncertain outcome. If a batch fails, everything before it is
 *    committed and recorded, and the ledger says exactly where it stopped.
 * 3. **Explainability.** A failure reports which operation failed and why. The
 *    caller never returns a bare 500 while leaving data in an unknown state.
 */

/** A commit claimed longer ago than this is assumed dead and may be resumed. */
const STALE_COMMIT_MS = 5 * 60 * 1000;

export type CommitOutcome = {
  status: "completed" | "completed_with_issues" | "failed" | "conflict";
  created: Record<MigrationEntity, number>;
  linked: number;
  skipped: number;
  failed: number;
  message?: string;
  /** The operation that stopped the commit, when one did. */
  failedOperation?: { label: string; entity: string; error: string };
};

function isoToDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  // Date-only values are anchored at UTC midnight so the calendar day cannot
  // shift with the server's timezone.
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function str(source: Record<string, unknown>, key: string, max?: number): string | null {
  const value = source[key];
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  return max ? trimmed.slice(0, max) : trimmed;
}

function money(source: Record<string, unknown>, key: string): Prisma.Decimal | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? new Prisma.Decimal(value.toFixed(2)) : null;
}

function currencyOf(source: Record<string, unknown>, fallback: string): string {
  const value = str(source, "currency");
  return value && /^[A-Z]{3}$/.test(value) ? value : fallback;
}

function tagsOf(source: Record<string, unknown>): string[] {
  return Array.isArray(source.tags) ? (source.tags as unknown[]).filter((tag): tag is string => typeof tag === "string") : [];
}

function enumOf(source: Record<string, unknown>, key: string, allowed: ReadonlySet<string>, fallback: string): string {
  const value = str(source, key);
  return value && allowed.has(value) ? value : fallback;
}

type StagedRecord = {
  id: string;
  entity: string;
  sourceKey: string;
  sourceRow: number;
  importFileId: string | null;
  normalized: Prisma.JsonValue;
  resolvedRelationships: Prisma.JsonValue;
  duplicateCandidates: Prisma.JsonValue;
  groupKey: string | null;
};

type Resolution = {
  /** Identity group → the client id it ended up as (created or existing). */
  clientIdByGroup: Map<string, string>;
  /** Project record sourceKey → the project id it ended up as. */
  projectIdBySourceKey: Map<string, string>;
};

function relationshipTarget(
  record: StagedRecord,
  field: "clientId" | "projectId",
  resolution: Resolution,
): string | null {
  const resolved = (record.resolvedRelationships || {}) as Record<string, { groupKey: string | null; existingId: string | null }>;
  const entry = resolved[field];
  if (!entry) return null;
  if (entry.existingId) return entry.existingId;
  if (!entry.groupKey) return null;
  return field === "clientId"
    ? resolution.clientIdByGroup.get(entry.groupKey) || null
    : resolution.projectIdBySourceKey.get(entry.groupKey) || null;
}

/**
 * Materialize the plan into a ledger.
 *
 * `skipDuplicates` against the (migration, operationKey) unique index makes
 * this safe to call repeatedly — a retried commit re-materializes nothing.
 */
async function materializeLedger(importJobId: string, plan: ImportPlan): Promise<void> {
  const batchSize = MIGRATION_LIMITS.commitBatchSize;
  await prisma.migrationOperation.createMany({
    data: plan.operations.map((operation) => ({
      importJobId,
      operationKey: operation.operationKey,
      planHash: plan.planHash,
      sequence: operation.sequence,
      batch: Math.floor(operation.sequence / batchSize),
      action: operation.action,
      entity: operation.entity,
      sourceKey: operation.sourceKey,
      payloadHash: operation.payloadHash,
    })),
    skipDuplicates: true,
  });
}

export async function commitMigration(
  userId: string,
  importJobId: string,
  expectedPlanHash: string,
): Promise<CommitOutcome> {
  const empty = { clients: 0, projects: 0, invoices: 0, expenses: 0 } as Record<MigrationEntity, number>;

  const job = await prisma.importJob.findFirst({
    where: { id: importJobId, userId, engineVersion: 2 },
    select: { id: true, status: true, planHash: true, plan: true, startedAt: true, defaultCurrency: true, createdAt: true },
  });
  if (!job) {
    return { status: "conflict", created: empty, linked: 0, skipped: 0, failed: 0, message: "This migration could not be found." };
  }

  // The plan the user approved must be the plan that runs. Anything else means
  // the migration changed underneath them, and they need to look again.
  if (!job.planHash || job.planHash !== expectedPlanHash) {
    return {
      status: "conflict",
      created: empty,
      linked: 0,
      skipped: 0,
      failed: 0,
      message: "This migration changed since you reviewed it. Open it again to see the current plan.",
    };
  }

  const plan = job.plan as unknown as ImportPlan | null;
  if (!plan?.operations) {
    return { status: "conflict", created: empty, linked: 0, skipped: 0, failed: 0, message: "This migration has no plan to run yet." };
  }

  // Claim the migration. A second concurrent request matches no rows and is
  // told to wait rather than running the same operations twice.
  const claimed = await prisma.importJob.updateMany({
    where: { id: importJobId, userId, status: { in: ["ready", "review_required", "failed"] } },
    data: { status: "committing", phase: phaseFor("committing"), startedAt: new Date(), error: null },
  });

  if (!claimed.count) {
    const fresh = await prisma.importJob.findFirst({ where: { id: importJobId, userId }, select: { status: true, startedAt: true } });
    const stale = fresh?.status === "committing" && fresh.startedAt && Date.now() - fresh.startedAt.getTime() > STALE_COMMIT_MS;
    if (!stale) {
      return {
        status: "conflict",
        created: empty,
        linked: 0,
        skipped: 0,
        failed: 0,
        message: fresh?.status === "committing"
          ? "This migration is already being imported."
          : "This migration has already been imported.",
      };
    }
    // A previous attempt died mid-flight. The ledger makes resuming safe.
  }

  const workspaceUser = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
  const fallbackCurrency = job.defaultCurrency || workspaceUser?.currency || "USD";

  await materializeLedger(importJobId, plan);

  await recordMigrationEvent(userId, MIGRATION_EVENTS.commitStarted, importJobId, {
    recordCount: plan.operations.length,
  });

  const created: Record<MigrationEntity, number> = { ...empty };
  let linked = 0;
  let skipped = 0;
  const resolution: Resolution = { clientIdByGroup: new Map(), projectIdBySourceKey: new Map() };

  // Seed the resolution map from work a previous attempt already applied, so a
  // resumed commit still attaches projects and invoices to the right clients.
  const alreadyApplied = await prisma.migrationOperation.findMany({
    where: { importJobId, status: "applied" },
    select: { sourceKey: true, entity: true, targetId: true },
  });
  if (alreadyApplied.length) {
    const staged = await prisma.migrationRecord.findMany({
      where: { importJobId, sourceKey: { in: alreadyApplied.map((operation) => operation.sourceKey) } },
      select: { sourceKey: true, groupKey: true },
    });
    const groupBySourceKey = new Map(staged.map((record) => [record.sourceKey, record.groupKey]));
    for (const operation of alreadyApplied) {
      if (!operation.targetId) continue;
      if (operation.entity === "clients") {
        const group = groupBySourceKey.get(operation.sourceKey);
        if (group) resolution.clientIdByGroup.set(group, operation.targetId);
      }
      if (operation.entity === "projects") resolution.projectIdBySourceKey.set(operation.sourceKey, operation.targetId);
    }
  }

  // Fetch every operation that has not actually applied. `pending` is the
  // fresh-commit case; `failed` is the resume case — a previous attempt died
  // mid-batch and marked that batch failed, and resuming must re-run exactly
  // those operations. The ledger's per-operation idempotency (unique
  // operationKey + the applied status flip inside the create transaction)
  // makes re-running them safe: records already created by a prior attempt are
  // skipped, not duplicated.
  const batches = await prisma.migrationOperation.findMany({
    where: { importJobId, planHash: plan.planHash, status: { in: ["pending", "failed"] } },
    orderBy: { sequence: "asc" },
    select: { id: true, operationKey: true, action: true, entity: true, sourceKey: true, sequence: true, batch: true },
  });

  const byBatch = new Map<number, typeof batches>();
  for (const operation of batches) {
    const list = byBatch.get(operation.batch) || [];
    list.push(operation);
    byBatch.set(operation.batch, list);
  }

  for (const [, operations] of [...byBatch.entries()].sort((a, b) => a[0] - b[0])) {
    const staged = await prisma.migrationRecord.findMany({
      where: { importJobId, sourceKey: { in: operations.map((operation) => operation.sourceKey) } },
      select: {
        id: true, entity: true, sourceKey: true, sourceRow: true, importFileId: true,
        normalized: true, resolvedRelationships: true, duplicateCandidates: true, groupKey: true,
      },
    });
    const stagedByKey = new Map(staged.map((record) => [record.sourceKey, record as StagedRecord]));

    try {
      await prisma.$transaction(async (transaction) => {
        for (const operation of operations) {
          const record = stagedByKey.get(operation.sourceKey);
          if (!record) {
            await transaction.migrationOperation.update({
              where: { id: operation.id },
              data: { status: "skipped", error: "The staged record no longer exists.", appliedAt: new Date() },
            });
            skipped += 1;
            continue;
          }

          if (operation.action === "link") {
            // Linking creates and modifies nothing. The existing record is left
            // exactly as it is; only the migration's own bookkeeping is written,
            // plus the mapping that lets later records attach to it.
            const targetId = linkTargetFromDuplicates(record);
            if (targetId && record.entity === "clients" && record.groupKey) {
              resolution.clientIdByGroup.set(record.groupKey, targetId);
            }
            if (targetId && record.entity === "projects") {
              resolution.projectIdBySourceKey.set(record.sourceKey, targetId);
            }
            await transaction.migrationOperation.update({
              where: { id: operation.id },
              data: { status: "applied", targetType: record.entity, targetId, appliedAt: new Date() },
            });
            await transaction.migrationRecord.update({
              where: { id: record.id },
              data: { targetType: record.entity, targetId },
            });
            linked += 1;
            continue;
          }

          const outcome = await createEntity(transaction, userId, record, resolution, fallbackCurrency);
          if (!outcome) {
            await transaction.migrationOperation.update({
              where: { id: operation.id },
              data: { status: "skipped", error: "A record with these details already exists.", appliedAt: new Date() },
            });
            skipped += 1;
            continue;
          }

          created[record.entity as MigrationEntity] += 1;
          await transaction.migrationRecord.update({
            where: { id: record.id },
            data: { targetType: outcome.targetType, targetId: outcome.id },
          });
          await transaction.importedRecord.upsert({
            where: {
              importJobId_sourceType_sourceKey: {
                importJobId,
                sourceType: record.entity,
                sourceKey: record.sourceKey,
              },
            },
            create: {
              importJobId,
              importFileId: record.importFileId,
              sourceRow: record.sourceRow,
              sourceType: record.entity,
              sourceKey: record.sourceKey,
              targetType: outcome.targetType,
              targetId: outcome.id,
              action: "created",
              targetStamp: outcome.updatedAt,
            },
            update: {},
          });
          await transaction.migrationOperation.update({
            where: { id: operation.id },
            data: { status: "applied", targetType: outcome.targetType, targetId: outcome.id, appliedAt: new Date() },
          });
        }
      }, { timeout: 60_000 });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "This batch could not be imported.";
      const failing = operations[0];
      await prisma.migrationOperation.updateMany({
        where: { importJobId, id: { in: operations.map((operation) => operation.id) }, status: "pending" },
        data: { status: "failed", error: message },
      });
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: "failed",
          phase: phaseFor("failed"),
          error: message,
          createdRecords: totalOf(created),
          skippedRecords: skipped,
          completedAt: new Date(),
        },
      });
      await recordMigrationEvent(userId, MIGRATION_EVENTS.failed, importJobId, {
        recordCount: totalOf(created),
        errorCount: operations.length,
        reason: message.slice(0, 200),
      });
      return {
        status: "failed",
        created,
        linked,
        skipped,
        failed: operations.length,
        // Everything before this batch really was imported. Saying so is the
        // difference between a recoverable failure and an unknowable one.
        message: `${totalOf(created)} records were imported before this stopped. Nothing after it was written.`,
        failedOperation: { label: failing.sourceKey, entity: failing.entity, error: message },
      };
    }
  }

  const remaining = await prisma.migrationOperation.count({ where: { importJobId, status: "pending" } });
  const failedCount = await prisma.migrationOperation.count({ where: { importJobId, status: "failed" } });
  const finalStatus = failedCount > 0 || remaining > 0 || plan.blocked.length > 0 ? "completed_with_issues" : "completed";

  await prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: finalStatus,
      phase: phaseFor(finalStatus),
      createdRecords: totalOf(created),
      updatedRecords: linked,
      skippedRecords: skipped + plan.blocked.length,
      unresolvedCount: plan.blocked.length,
      completedAt: new Date(),
      error: null,
      summary: {
        metrics: plan.metrics,
        counts: plan.counts,
        created,
        linked,
        skipped,
        blocked: plan.blocked.length,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  await recordMigrationEvent(userId, MIGRATION_EVENTS.completed, importJobId, {
    recordCount: totalOf(created),
    entityCounts: created,
    autoMappingRate: plan.metrics.autoMappingRate,
    relationshipResolutionRate: plan.metrics.relationshipResolutionRate,
    duplicateRate: plan.metrics.duplicateRate,
    errorCount: plan.metrics.errorCount,
    warningCount: plan.metrics.warningCount,
    timeToImportMs: Date.now() - job.createdAt.getTime(),
    outcome: finalStatus,
  });

  return { status: finalStatus, created, linked, skipped, failed: failedCount };
}

function totalOf(created: Record<MigrationEntity, number>): number {
  return created.clients + created.projects + created.invoices + created.expenses;
}

/** The existing workspace record a `link` operation attaches to. */
function linkTargetFromDuplicates(record: StagedRecord): string | null {
  const candidates = record.duplicateCandidates as unknown as Array<{ scope: string; targetId: string | null }> | null;
  if (!Array.isArray(candidates)) return null;
  return candidates.find((candidate) => candidate.scope === "workspace")?.targetId || null;
}

type CreateOutcome = { id: string; targetType: string; updatedAt: Date };

/**
 * Create one production record from staged IR.
 *
 * Returns null when a uniqueness constraint says the record already exists —
 * that is treated as "already imported", not as a failure, so a race between
 * two commits cannot abort the whole migration.
 */
async function createEntity(
  transaction: Prisma.TransactionClient,
  userId: string,
  record: StagedRecord,
  resolution: Resolution,
  fallbackCurrency: string,
): Promise<CreateOutcome | null> {
  const values = (record.normalized || {}) as Record<string, unknown>;

  try {
    switch (record.entity) {
      case "clients": {
          const client = await transaction.client.create({
            data: {
              dataOrigin: "imported",
            userId,
            name: str(values, "name", 160) || "Unnamed client",
            email: str(values, "email", 254),
            phone: str(values, "phone", 80),
            company: str(values, "company", 160),
            website: str(values, "website", 500),
            address: str(values, "address", 1_000),
            notes: str(values, "notes", 2_000),
            status: enumOf(values, "status", CLIENT_STATUS_SET, "active"),
            avatarColor: "#2563EB",
            tags: tagsOf(values),
          },
          select: { id: true, updatedAt: true },
        });
        if (record.groupKey) resolution.clientIdByGroup.set(record.groupKey, client.id);
        return { id: client.id, targetType: "client", updatedAt: client.updatedAt };
      }

      case "projects": {
          const project = await transaction.project.create({
            data: {
              dataOrigin: "imported",
            userId,
            clientId: relationshipTarget(record, "clientId", resolution),
            title: str(values, "title", 200) || "Untitled project",
            description: str(values, "description", 2_000),
            status: enumOf(values, "status", PROJECT_STATUS_SET, "active"),
            priority: enumOf(values, "priority", PROJECT_PRIORITY_SET, "medium"),
            startDate: isoToDate(values.startDate),
            dueDate: isoToDate(values.dueDate),
            budget: money(values, "budget"),
            currency: currencyOf(values, fallbackCurrency),
            tags: tagsOf(values),
          },
          select: { id: true, updatedAt: true },
        });
        resolution.projectIdBySourceKey.set(record.sourceKey, project.id);
        return { id: project.id, targetType: "project", updatedAt: project.updatedAt };
      }

      case "invoices": {
        const total = money(values, "total") || new Prisma.Decimal(0);
        const subtotal = money(values, "subtotal") || total;
        const issueDate = isoToDate(values.issueDate) || new Date();
        const status = enumOf(values, "status", INVOICE_STATUS_SET, "draft");
          const invoice = await transaction.invoice.create({
            data: {
              dataOrigin: "imported",
            userId,
            clientId: relationshipTarget(record, "clientId", resolution),
            projectId: relationshipTarget(record, "projectId", resolution),
            invoiceNumber: str(values, "invoiceNumber", 80) || `IMPORT-${record.sourceKey}`,
            status,
            currency: currencyOf(values, fallbackCurrency),
            subtotal,
            taxRate: money(values, "taxRate") || new Prisma.Decimal(0),
             taxAmount: money(values, "taxAmount") || new Prisma.Decimal(0),
             total,
             amountPaid: status === "paid" ? total : new Prisma.Decimal(0),
             issueDate,
            dueDate: isoToDate(values.dueDate),
            // A paid invoice with no payment date falls back to its issue date;
            // the user was warned about this during review.
            paidDate: status === "paid" ? isoToDate(values.paidDate) || issueDate : null,
            notes: str(values, "notes", 2_000),
            items: {
              create: {
                description: str(values, "notes", 200) || `Imported invoice ${str(values, "invoiceNumber", 80) || ""}`.trim(),
                quantity: new Prisma.Decimal(1),
                unitPrice: subtotal,
                amount: subtotal,
              },
            },
          },
          select: { id: true, updatedAt: true },
        });
        return { id: invoice.id, targetType: "invoice", updatedAt: invoice.updatedAt };
      }

      case "expenses": {
        const amount = money(values, "amount");
          const expense = await transaction.expense.create({
            data: {
              dataOrigin: "imported",
            userId,
            projectId: relationshipTarget(record, "projectId", resolution),
            description: str(values, "description", 500) || "Imported expense",
            // Expenses are stored as positive amounts; a negative source value
            // was reported as a warning during review.
            amount: amount ? amount.abs() : new Prisma.Decimal(0),
            category: enumOf(values, "category", EXPENSE_CATEGORY_SET, "other"),
            currency: currencyOf(values, fallbackCurrency),
            date: isoToDate(values.date) || new Date(),
            receiptUrl: str(values, "receiptUrl", 500),
            isBillable: values.isBillable === true,
            isReimbursed: values.isReimbursed === true,
          },
          select: { id: true, updatedAt: true },
        });
        return { id: expense.id, targetType: "expense", updatedAt: expense.updatedAt };
      }

      default:
        return null;
    }
  } catch (error) {
    // A unique-constraint collision means this record is already present.
    // Skipping is correct and non-destructive; failing the batch would not be.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }
}
