import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { MIGRATION_EVENTS, recordMigrationEvent } from "@/utils/migration/analytics";
import { phaseFor } from "@/utils/migration/session";
import { rollbackEligibility } from "@/lib/migration/state";

/**
 * Rollback.
 *
 * Scope is deliberately narrow and stated plainly to the user: **records this
 * migration created, which nobody has touched since.** Everything else is
 * reported as a conflict and left alone.
 *
 * Specifically, rollback never deletes:
 *   - records that existed before the migration (a `link` created nothing)
 *   - records created by a different migration or by hand
 *   - records edited since they were imported
 *   - records something else now depends on
 *
 * A destructive operation that is only *mostly* right is worse than one that
 * refuses and explains itself.
 */

const ROLLBACKABLE_STATES = new Set(["completed", "completed_with_issues", "failed"]);

export type RollbackConflict = {
  targetType: string;
  targetId: string;
  label: string;
  reason: string;
};

export type RollbackOutcome = {
  ok: boolean;
  deleted: Record<string, number>;
  conflicts: RollbackConflict[];
  message?: string;
};

type Candidate = {
  targetType: string;
  targetId: string;
  targetStamp: Date | null;
};

/**
 * Decide which imported records are still safe to remove.
 *
 * A record is eligible when its current `updatedAt` still matches the stamp
 * taken at import. Any later edit means the user has invested something in it,
 * and deleting it would destroy their work.
 */
async function partitionCandidates(
  userId: string,
  candidates: Candidate[],
): Promise<{ eligible: Map<string, string[]>; conflicts: RollbackConflict[] }> {
  const eligible = new Map<string, string[]>();
  const conflicts: RollbackConflict[] = [];

  const byType = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const list = byType.get(candidate.targetType) || [];
    list.push(candidate);
    byType.set(candidate.targetType, list);
  }

  for (const [targetType, group] of byType) {
    const ids = group.map((candidate) => candidate.targetId);
    const stampById = new Map(group.map((candidate) => [candidate.targetId, candidate.targetStamp]));

    const current = await loadCurrent(userId, targetType, ids);
    const currentById = new Map(current.map((row) => [row.id, row]));

    for (const id of ids) {
      const row = currentById.get(id);
      if (!row) continue; // already gone; nothing to undo

      const verdict = rollbackEligibility(stampById.get(id) ?? null, row.updatedAt);
      if (!verdict.eligible) {
        conflicts.push({ targetType, targetId: id, label: row.label, reason: verdict.reason });
        continue;
      }
      const list = eligible.get(targetType) || [];
      list.push(id);
      eligible.set(targetType, list);
    }
  }

  return { eligible, conflicts };
}

type CurrentRow = { id: string; label: string; updatedAt: Date };

async function loadCurrent(userId: string, targetType: string, ids: string[]): Promise<CurrentRow[]> {
  if (!ids.length) return [];
  switch (targetType) {
    case "client":
      return (await prisma.client.findMany({ where: { id: { in: ids }, userId }, select: { id: true, name: true, updatedAt: true } }))
        .map((row) => ({ id: row.id, label: row.name, updatedAt: row.updatedAt }));
    case "project":
      return (await prisma.project.findMany({ where: { id: { in: ids }, userId }, select: { id: true, title: true, updatedAt: true } }))
        .map((row) => ({ id: row.id, label: row.title, updatedAt: row.updatedAt }));
    case "invoice":
      return (await prisma.invoice.findMany({ where: { id: { in: ids }, userId }, select: { id: true, invoiceNumber: true, updatedAt: true } }))
        .map((row) => ({ id: row.id, label: `Invoice ${row.invoiceNumber}`, updatedAt: row.updatedAt }));
    case "expense":
      return (await prisma.expense.findMany({ where: { id: { in: ids }, userId }, select: { id: true, description: true, updatedAt: true } }))
        .map((row) => ({ id: row.id, label: row.description, updatedAt: row.updatedAt }));
    default:
      return [];
  }
}

/**
 * Report what a rollback would do, without doing it.
 *
 * The UI shows this before asking for confirmation, so "undo" is never a leap
 * of faith.
 */
export async function previewRollback(userId: string, importJobId: string): Promise<RollbackOutcome> {
  const job = await prisma.importJob.findFirst({
    where: { id: importJobId, userId },
    select: { status: true, rolledBackAt: true },
  });
  if (!job) return { ok: false, deleted: {}, conflicts: [], message: "This migration could not be found." };
  if (job.rolledBackAt || !ROLLBACKABLE_STATES.has(job.status)) {
    return { ok: false, deleted: {}, conflicts: [], message: "This migration cannot be undone." };
  }

  const records = await prisma.importedRecord.findMany({
    where: { importJobId, action: "created" },
    select: { targetType: true, targetId: true, targetStamp: true },
  });
  const { eligible, conflicts } = await partitionCandidates(userId, records);

  return {
    ok: true,
    deleted: Object.fromEntries([...eligible.entries()].map(([type, ids]) => [type, ids.length])),
    conflicts,
  };
}

/**
 * Delete the records this migration created that remain untouched.
 *
 * Deletion order is the reverse of creation so a client is never removed while
 * an invoice still points at it. Where a dependency survives (because the user
 * edited it), the parent is reported as a conflict instead of being force-
 * deleted — the schema's `SetNull` would otherwise quietly orphan real work.
 */
export async function executeRollback(userId: string, importJobId: string): Promise<RollbackOutcome> {
  const preview = await previewRollback(userId, importJobId);
  if (!preview.ok) return preview;

  const records = await prisma.importedRecord.findMany({
    where: { importJobId, action: "created" },
    select: { targetType: true, targetId: true, targetStamp: true },
  });
  const { eligible, conflicts } = await partitionCandidates(userId, records);

  const deleted: Record<string, number> = {};
  const blockedParents: RollbackConflict[] = [];

  await prisma.$transaction(async (transaction) => {
    // Children first: expenses and invoices reference projects and clients.
    const expenses = eligible.get("expense") || [];
    if (expenses.length) {
      deleted.expenses = (await transaction.expense.deleteMany({ where: { id: { in: expenses }, userId } })).count;
    }
    const invoices = eligible.get("invoice") || [];
    if (invoices.length) {
      deleted.invoices = (await transaction.invoice.deleteMany({ where: { id: { in: invoices }, userId } })).count;
    }

    const projects = eligible.get("project") || [];
    if (projects.length) {
      // A project still carrying invoices or expenses that survived rollback is
      // load-bearing for data the user kept, so it stays.
      const stillReferenced = await transaction.project.findMany({
        where: { id: { in: projects }, userId, OR: [{ invoices: { some: {} } }, { expenses: { some: {} } }, { contracts: { some: {} } }] },
        select: { id: true, title: true },
      });
      const blockedIds = new Set(stillReferenced.map((project) => project.id));
      for (const project of stillReferenced) {
        blockedParents.push({
          targetType: "project",
          targetId: project.id,
          label: project.title,
          reason: "Records you kept are still attached to this project.",
        });
      }
      const removable = projects.filter((id) => !blockedIds.has(id));
      if (removable.length) {
        deleted.projects = (await transaction.project.deleteMany({ where: { id: { in: removable }, userId } })).count;
      }
    }

    const clients = eligible.get("client") || [];
    if (clients.length) {
      const stillReferenced = await transaction.client.findMany({
        where: { id: { in: clients }, userId, OR: [{ projects: { some: {} } }, { invoices: { some: {} } }, { contracts: { some: {} } }] },
        select: { id: true, name: true },
      });
      const blockedIds = new Set(stillReferenced.map((client) => client.id));
      for (const client of stillReferenced) {
        blockedParents.push({
          targetType: "client",
          targetId: client.id,
          label: client.name,
          reason: "Records you kept are still attached to this client.",
        });
      }
      const removable = clients.filter((id) => !blockedIds.has(id));
      if (removable.length) {
        deleted.clients = (await transaction.client.deleteMany({ where: { id: { in: removable }, userId } })).count;
      }
    }

    const removedIds = [...expenses, ...invoices, ...(eligible.get("project") || []), ...(eligible.get("client") || [])]
      .filter((id) => !blockedParents.some((conflict) => conflict.targetId === id));

    await transaction.importedRecord.deleteMany({ where: { importJobId, targetId: { in: removedIds } } });
    await transaction.migrationRecord.updateMany({
      where: { importJobId, targetId: { in: removedIds } },
      data: { targetId: null, targetType: null },
    });
    await transaction.migrationOperation.updateMany({
      where: { importJobId, targetId: { in: removedIds } },
      data: { status: "rolled_back", targetId: null },
    });

    await transaction.importJob.update({
      where: { id: importJobId },
      data: {
        status: "rolled_back",
        phase: phaseFor("rolled_back"),
        rolledBackAt: new Date(),
        summary: {
          rollback: { deleted, conflicts: [...conflicts, ...blockedParents].length },
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }, { timeout: 60_000 });

  await recordMigrationEvent(userId, MIGRATION_EVENTS.rolledBack, importJobId, {
    recordCount: Object.values(deleted).reduce((sum, count) => sum + count, 0),
    entityCounts: deleted,
    errorCount: conflicts.length + blockedParents.length,
  });

  return { ok: true, deleted, conflicts: [...conflicts, ...blockedParents] };
}
