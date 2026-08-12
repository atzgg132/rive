import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { mappingOptions } from "@/lib/migration/fields";
import { MIGRATION_ENTITIES, type ImportPlan, type MigrationState, type SourceClassification } from "@/lib/migration/types";
import type { RecordResolution, SourceOverrides } from "@/lib/migration/pipeline";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { analyzeMigration } from "@/utils/migration/analyze";
import { isEditable, loadSession } from "@/utils/migration/session";
import { MIGRATION_EVENTS, recordMigrationEvent } from "@/utils/migration/analytics";
import { isValidIsoCurrency } from "@/lib/migration/normalize/money";

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
  const where: Prisma.MigrationRecordWhereInput = { importJobId: job.id };
  if (filter === "issues") where.status = { in: ["review", "error"] };
  else if (MIGRATION_ENTITIES.includes(filter as never)) where.entity = filter;

  const [records, total, counts] = await Promise.all([
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
    prisma.migrationRecord.groupBy({ by: ["entity", "status"], where: { importJobId: job.id }, _count: true }),
  ]);

  const plan = job.plan as unknown as ImportPlan | null;

  return NextResponse.json({
    success: true,
    migration: {
      id: job.id,
      state: job.status as MigrationState,
      editable: isEditable(job.status as MigrationState),
      planHash: job.planHash,
      planVersion: job.planVersion,
      defaultCurrency: job.defaultCurrency,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      rolledBackAt: job.rolledBackAt,
      error: job.error,
    },
    sources: job.files.map((file) => ({
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

  try {
    const analysis = await analyzeMigration(session.userId, job.id);
    return NextResponse.json({
      success: true,
      state: analysis.state,
      // The plan hash changes whenever a decision changes the outcome, which is
      // exactly what invalidates a stale preview.
      planHash: analysis.plan.planHash,
      counts: analysis.plan.counts,
      totals: analysis.plan.totals,
      metrics: analysis.plan.metrics,
      reviewCount: analysis.plan.reviewItems.length,
      blockedCount: analysis.plan.blocked.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Re-analysis failed.";
    return NextResponse.json({ success: false, message: `Rive could not re-check this migration: ${message}` }, { status: 500 });
  }
}

/** Discard a migration that has not been imported. */
export async function DELETE(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) return unavailable();
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;
  const job = await loadSession(session.userId, id);
  if (!job) return NextResponse.json({ success: false, message: "Migration not found." }, { status: 404 });
  if (!isEditable(job.status as MigrationState)) {
    return NextResponse.json(
      { success: false, message: "This migration has been imported. Undo it instead of discarding it." },
      { status: 409 },
    );
  }

  // Cascades remove the staged records, files, and ledger with the job.
  await prisma.importJob.deleteMany({ where: { id: job.id, userId: session.userId } });
  return NextResponse.json({ success: true });
}
