import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { mappingOptions } from "@/lib/migration/fields";
import { MIGRATION_ENTITIES, type ImportPlan, type MigrationState, type SourceClassification } from "@/lib/migration/types";
import type { RecordResolution, SourceOverrides } from "@/lib/migration/pipeline";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { isEditable, loadSession, transition } from "@/utils/migration/session";
import { MIGRATION_EVENTS, recordMigrationEvent } from "@/utils/migration/analytics";
import { isValidIsoCurrency } from "@/lib/migration/normalize/money";
import { dispatchMigrationWork } from "@/utils/migration/dispatch";

/**
 * A single migration: read its full state, or record a review decision.
 *
 * `GET` is what makes migrations resumable — everything the wizard needs lives
 * server-side, so a refresh or a new device picks up exactly where the user
 * left off. `PATCH` records decisions and re-runs the pipeline.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/** Records returned to the review screen in one page. */
const REVIEW_PAGE_SIZE = 50;

function unavailable() {
  return NextResponse.json({ success: false, message: "Migration is not available yet." }, { status: 404 });
}

export async function GET(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) return unavailable();
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;
  const job = await loadSession(session.userId, id);
  if (!job) return NextResponse.json({ success: false, message: "Migration not found." }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(0, Number.parseInt(searchParams.get("page") || "0", 10) || 0);
  const filter = searchParams.get("filter") || "issues";

  // The review screen only ever needs the records that need attention. Clean
  // rows are counted, not shipped — a 20,000-row migration must not become a
  // 20,000-row JSON payload.
  const where: Prisma.MigrationRecordWhereInput = { importJobId: job.id, active: true };
  if (filter === "issues") where.status = { in: ["review", "error"] };
  else if (MIGRATION_ENTITIES.includes(filter as never)) where.entity = filter;

  const [records, total, counts, operationCounts, excludedRecords] = await Promise.all([
    prisma.migrationRecord.findMany({
      where,
      orderBy: [{ entity: "asc" }, { sourceRow: "asc" }],
      skip: page * REVIEW_PAGE_SIZE,
      take: REVIEW_PAGE_SIZE,
      select: {
        sourceKey: true, entity: true, sourceRow: true, status: true, action: true,
        confidence: true, normalized: true, raw: true, warnings: true, errors: true,
        relationshipCandidates: true, duplicateCandidates: true,
        importFile: { select: { name: true, sheetName: true } },
      },
    }),
    prisma.migrationRecord.count({ where }),
    prisma.migrationRecord.groupBy({ by: ["entity", "status"], where: { importJobId: job.id, active: true }, _count: true }),
    prisma.migrationOperation.groupBy({ by: ["status"], where: { importJobId: job.id }, _count: true }),
    prisma.migrationRecord.findMany({
      where: { importJobId: job.id, active: true, action: "skip" },
      orderBy: [{ entity: "asc" }, { sourceRow: "asc" }],
      take: 200,
      select: { sourceKey: true, entity: true, sourceRow: true, errors: true, warnings: true },
    }),
  ]);

  const plan = job.plan as unknown as ImportPlan | null;
  const operationCount = (status: string) => operationCounts.find((entry) => entry.status === status)?._count || 0;
  const appliedCount = operationCount("applied") + operationCount("skipped");
  const pendingCount = operationCount("pending") + operationCount("failed");
  const progressTotal = Math.max(0, job.progressTotal);
  const progressPercent = progressTotal > 0
    ? Math.min(100, Math.round((job.progressCompleted / progressTotal) * 100))
    : (["completed", "completed_with_issues"].includes(job.status) ? 100 : 0);
  const canCommit = Boolean(
    plan
    && plan.reviewItems.length === 0
    && plan.blocked.length === 0
    && ["ready", "review_required"].includes(job.status),
  );

  return NextResponse.json({
    success: true,
    migration: {
      id: job.id,
      state: job.status as MigrationState,
      editable: isEditable(job.status as MigrationState) && appliedCount === 0 && pendingCount === 0,
      planHash: job.planHash,
      planVersion: job.planVersion,
      defaultCurrency: job.defaultCurrency,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      rolledBackAt: job.rolledBackAt,
      error: job.error,
      failurePhase: job.failurePhase,
      failureCode: job.failureCode,
      attemptCount: job.attemptCount,
    },
    sources: job.files.map((file) => ({
      fileId: file.id,
      sourceId: file.sourceId,
      name: file.name,
      sheetName: file.sheetName,
      entity: file.entity,
      confidence: file.confidence,
      reason: file.reason,
      rowCount: file.rowCount,
      headers: file.headers,
      sample: file.sample,
      profile: file.profile,
      mapping: file.mapping,
      overrides: file.overrides,
      uploadStatus: job.status === "queued_analysis" && ["verified", "parsed"].includes(file.uploadStatus)
        ? "queued"
        : ["profiling", "mapping"].includes(job.status) && ["verified", "parsed"].includes(file.uploadStatus)
          ? "analyzing"
          : file.uploadStatus,
      uploadedAt: file.uploadedAt,
      uploadError: file.uploadError,
      // Only the fields that belong to this source's record type, so the
      // manual mapper never offers an expense field on an invoice sheet.
      options: MIGRATION_ENTITIES.includes(file.entity as never)
        ? mappingOptions(file.entity as never)
        : [],
    })),
    plan: plan
      ? {
          planHash: plan.planHash,
          counts: plan.counts,
          totals: plan.totals,
          metrics: plan.metrics,
          reviewItems: plan.reviewItems.slice(0, 200),
          blocked: plan.blocked.slice(0, 200),
          operationCount: plan.operations.length,
        }
      : null,
    records,
    pagination: { page, pageSize: REVIEW_PAGE_SIZE, total },
    counts,
    summary: job.summary,
    progress: {
      phase: job.phase,
      completed: job.progressCompleted,
      total: progressTotal,
      percent: progressPercent,
      lastHeartbeatAt: job.lastHeartbeatAt,
    },
    canCommit,
    unresolved: {
      review: plan?.reviewItems.length || 0,
      invalid: plan?.blocked.length || 0,
      total: (plan?.reviewItems.length || 0) + (plan?.blocked.length || 0),
    },
    excluded: {
      count: plan?.totals.skip || excludedRecords.length,
      rows: excludedRecords,
      truncated: (plan?.totals.skip || 0) > excludedRecords.length,
    },
    recovery: {
      canRetry: job.status === "failed" && Boolean(job.failurePhase),
      canReplaceFiles: appliedCount === 0 && job.failurePhase !== "commit" && ["uploading", "failed"].includes(job.status),
      appliedCount,
      pendingCount,
      supportReference: `RIVE-MIG-${job.id.slice(-8).toUpperCase()}`,
      supportRequested: Boolean(job.supportRequestedAt),
    },
  });
}

function parseOverrides(value: unknown): SourceOverrides | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const overrides: SourceOverrides = {};

  if (typeof input.classification === "string") {
    const classification = input.classification as SourceClassification;
    if (MIGRATION_ENTITIES.includes(classification as never)) overrides.classification = classification;
  }
  if (input.mappings && typeof input.mappings === "object") {
    const mappings: Record<string, string | null> = {};
    for (const [column, target] of Object.entries(input.mappings as Record<string, unknown>)) {
      if (typeof column !== "string" || column.length > 300) continue;
      mappings[column] = typeof target === "string" && target ? target.slice(0, 80) : null;
    }
    overrides.mappings = mappings;
  }
  if (input.datePreferences && typeof input.datePreferences === "object") {
    const preferences: Record<string, "auto" | "dmy" | "mdy"> = {};
    for (const [column, preference] of Object.entries(input.datePreferences as Record<string, unknown>)) {
      if (preference === "dmy" || preference === "mdy" || preference === "auto") preferences[column] = preference;
    }
    overrides.datePreferences = preferences;
  }
  if (input.valueMappings && typeof input.valueMappings === "object") {
    const source = input.valueMappings as Record<string, unknown>;
    const valueMappings: NonNullable<SourceOverrides["valueMappings"]> = {};
    for (const key of ["currency", "status", "category", "priority"] as const) {
      const entries = source[key];
      if (!entries || typeof entries !== "object") continue;
      const clean: Record<string, string> = {};
      for (const [from, to] of Object.entries(entries as Record<string, unknown>)) {
        if (typeof to !== "string" || !to) continue;
        if (key === "currency" && !isValidIsoCurrency(to.toUpperCase())) continue;
        clean[from.slice(0, 200)] = key === "currency" ? to.toUpperCase() : to.slice(0, 80);
      }
      valueMappings[key] = clean;
    }
    overrides.valueMappings = valueMappings;
  }
  return overrides;
}

function parseResolutions(value: unknown): Record<string, RecordResolution> {
  if (!value || typeof value !== "object") return {};
  const resolutions: Record<string, RecordResolution> = {};
  for (const [sourceKey, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof sourceKey !== "string" || sourceKey.length > 300 || !raw || typeof raw !== "object") continue;
    const decision = (raw as Record<string, unknown>).decision;
    if (decision === "create" || decision === "skip" || decision === "merge") {
      resolutions[sourceKey] = { decision };
    } else if (decision === "link") {
      const existingId = (raw as Record<string, unknown>).existingId;
      const groupKey = (raw as Record<string, unknown>).groupKey;
      resolutions[sourceKey] = {
        decision: "link",
        existingId: typeof existingId === "string" ? existingId.slice(0, 64) : undefined,
        groupKey: typeof groupKey === "string" ? groupKey.slice(0, 300) : undefined,
      };
    }
  }
  return resolutions;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) return unavailable();
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`migration-edit:${session.userId}:${getRequestIp(req)}`, 200, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many changes at once. Try again shortly." }, { status: 429 });
  }

  const { id } = await context.params;
  const job = await loadSession(session.userId, id);
  if (!job) return NextResponse.json({ success: false, message: "Migration not found." }, { status: 404 });

  // A committed migration is a historical record. Editing it would make the
  // plan disagree with what was actually written.
  if (!isEditable(job.status as MigrationState)) {
    return NextResponse.json(
      { success: false, message: "This migration has already been imported and can no longer be changed." },
      { status: 409 },
    );
  }

  const committedOperations = await prisma.migrationOperation.count({ where: { importJobId: job.id } });
  if (committedOperations > 0) {
    return NextResponse.json(
      { success: false, message: "This migration has begun importing. Its approved plan is now frozen; retry that exact plan instead." },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 });
  }

  const updates = body as Record<string, unknown>;
  let manualMappingCount = 0;

  // Per-source overrides: classification, column mappings, date formats,
  // and bulk value corrections.
  if (updates.sources && typeof updates.sources === "object") {
    for (const [sourceId, raw] of Object.entries(updates.sources as Record<string, unknown>)) {
      const file = job.files.find((candidate) => candidate.sourceId === sourceId);
      if (!file) continue;
      const overrides = parseOverrides(raw);
      if (!overrides) continue;
      const existing = (file.overrides as SourceOverrides | null) || {};
      const merged: SourceOverrides = {
        ...existing,
        ...overrides,
        mappings: { ...(existing.mappings || {}), ...(overrides.mappings || {}) },
        datePreferences: { ...(existing.datePreferences || {}), ...(overrides.datePreferences || {}) },
        valueMappings: {
          currency: { ...(existing.valueMappings?.currency || {}), ...(overrides.valueMappings?.currency || {}) },
          status: { ...(existing.valueMappings?.status || {}), ...(overrides.valueMappings?.status || {}) },
          category: { ...(existing.valueMappings?.category || {}), ...(overrides.valueMappings?.category || {}) },
          priority: { ...(existing.valueMappings?.priority || {}), ...(overrides.valueMappings?.priority || {}) },
        },
      };
      manualMappingCount += Object.keys(overrides.mappings || {}).length;
      await prisma.importFile.update({
        where: { id: file.id },
        data: { overrides: merged as unknown as Prisma.InputJsonValue },
      });
    }
  }

  // Per-record review decisions, stored on the migration so they survive every
  // re-analysis.
  if (updates.resolutions && typeof updates.resolutions === "object") {
    const incoming = parseResolutions(updates.resolutions);
    const summary = (job.summary as Record<string, unknown> | null) || {};
    const existing = (summary.resolutions as Record<string, RecordResolution> | undefined) || {};
    await prisma.importJob.update({
      where: { id: job.id },
      data: { summary: { ...summary, resolutions: { ...existing, ...incoming } } as unknown as Prisma.InputJsonValue },
    });
    if (Object.keys(incoming).length) {
      await recordMigrationEvent(session.userId, MIGRATION_EVENTS.issueResolved, job.id, {
        recordCount: Object.keys(incoming).length,
      });
    }
  }

  if (typeof updates.defaultCurrency === "string") {
    const currency = updates.defaultCurrency.trim().toUpperCase();
    if (currency && !isValidIsoCurrency(currency)) {
      return NextResponse.json({ success: false, message: "Use a three-letter currency code." }, { status: 400 });
    }
    await prisma.importJob.update({ where: { id: job.id }, data: { defaultCurrency: currency || null } });
  }

  if (manualMappingCount) {
    await recordMigrationEvent(session.userId, MIGRATION_EVENTS.manualMappingUsed, job.id, {
      manualMappingCount,
    });
  }

  const queued = await prisma.importJob.update({
    where: { id: job.id },
    data: {
      inputRevision: { increment: 1 },
      status: "queued_analysis",
      phase: "queued_analysis",
      planHash: null,
      failurePhase: null,
      failureCode: null,
      error: null,
      progressCompleted: 0,
      completedAt: null,
    },
    select: { inputRevision: true },
  });
  try {
    const dispatched = await dispatchMigrationWork({
      migrationId: job.id,
      operation: "reanalyze",
      inputRevision: queued.inputRevision,
    });
    return NextResponse.json({
      success: true,
      state: dispatched.queued ? "queued_analysis" : dispatched.outcome?.status,
      inputRevision: queued.inputRevision,
    }, { status: dispatched.queued ? 202 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Re-analysis could not be queued.";
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "failed", phase: "recovery", failurePhase: "analysis", failureCode: "enqueue_failed", error: message },
    });
    return NextResponse.json({ success: false, message: `Rive could not re-check this migration: ${message}` }, { status: 500 });
  }
}

/** Mark an unfinished migration abandoned without deleting its audit trail. */
export async function POST(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) return unavailable();
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;
  const job = await loadSession(session.userId, id);
  if (!job) return NextResponse.json({ success: false, message: "Migration not found." }, { status: 404 });
  if (!isEditable(job.status as MigrationState)) {
    return NextResponse.json(
      { success: false, message: "Only an unfinished migration can be abandoned." },
      { status: 409 },
    );
  }

  const abandoned = await transition(
    job.id,
    session.userId,
    ["created", "uploading", "queued_analysis", "profiling", "mapping", "review_required", "ready", "failed"],
    "abandoned",
    { completedAt: new Date() },
  );
  if (!abandoned) {
    return NextResponse.json({ success: false, message: "This migration changed. Refresh and try again." }, { status: 409 });
  }
  await recordMigrationEvent(session.userId, MIGRATION_EVENTS.abandoned, job.id);
  return NextResponse.json({ success: true, status: "abandoned" });
}

/** Record deletion is intentionally unavailable. Migration history is retained. */
export async function DELETE() {
  return NextResponse.json(
    { success: false, message: "Migration deletion is disabled. Abandon the migration instead; imported records are never removed." },
    { status: 410 },
  );
}
