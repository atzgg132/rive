import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { MIGRATION_ENGINE_VERSION, MIGRATION_LIMITS } from "@/lib/migration/config";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { ingestUploads } from "@/utils/migration/ingest";
import { analyzeMigration, persistSources } from "@/utils/migration/analyze";
import { MIGRATION_EVENTS, recordMigrationEvent } from "@/utils/migration/analytics";
import { isValidIsoCurrency } from "@/lib/migration/normalize/money";

/**
 * Migration collection endpoint.
 *
 * `POST` starts a migration: it ingests uploads, stores them with provenance,
 * and runs the deterministic pipeline. `GET` lists migration history.
 */

export const runtime = "nodejs";
// Parsing happens server-side and can take a few seconds on a large workbook.
export const maxDuration = 60;

function unavailable() {
  return NextResponse.json({ success: false, message: "Migration is not available yet." }, { status: 404 });
}

export async function GET(req: NextRequest) {
  if (!migrationEngineAvailable()) return unavailable();
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const jobs = await prisma.importJob.findMany({
    where: { userId: session.userId, engineVersion: MIGRATION_ENGINE_VERSION },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      status: true,
      createdAt: true,
      completedAt: true,
      rolledBackAt: true,
      createdRecords: true,
      updatedRecords: true,
      skippedRecords: true,
      unresolvedCount: true,
      summary: true,
      files: { select: { name: true, sheetName: true, entity: true, rowCount: true } },
    },
  });

  return NextResponse.json({
    success: true,
    migrations: jobs.map((job) => ({
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      rolledBackAt: job.rolledBackAt,
      created: job.createdRecords,
      linked: job.updatedRecords,
      skipped: job.skippedRecords,
      warnings: job.unresolvedCount,
      files: job.files,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!migrationEngineAvailable()) return unavailable();
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  // Parsing is the expensive part of this endpoint, so the limit is on
  // uploads rather than reads.
  if (!rateLimit(`migration-upload:${session.userId}:${getRequestIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json(
      { success: false, message: "That is a lot of imports in one hour. Try again a little later." },
      { status: 429 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ success: false, message: "Choose the files you want to bring across." }, { status: 400 });

  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  const ingested = await ingestUploads(files);
  if (!ingested.ok) return NextResponse.json({ success: false, message: ingested.message }, { status: 400 });

  const requestedCurrency = String(form.get("defaultCurrency") || "").trim().toUpperCase();
  const defaultCurrency = isValidIsoCurrency(requestedCurrency) ? requestedCurrency : null;

  const job = await prisma.importJob.create({
    data: {
      userId: session.userId,
      engineVersion: MIGRATION_ENGINE_VERSION,
      source: "generic_tabular",
      sourceLabel: ingested.sources.map((source) => source.fileName).join(", ").slice(0, 160),
      status: "uploading",
      phase: "analysis",
      defaultCurrency,
    },
    select: { id: true },
  });

  await recordMigrationEvent(session.userId, MIGRATION_EVENTS.started, job.id, {
    fileCount: files.length,
    migrationVersion: MIGRATION_ENGINE_VERSION,
  });

  try {
    await persistSources(job.id, ingested.sources);
    await prisma.importJob.update({ where: { id: job.id }, data: { status: "profiling" } });

    await recordMigrationEvent(session.userId, MIGRATION_EVENTS.filesUploaded, job.id, {
      fileCount: ingested.sources.length,
      recordCount: ingested.sources.reduce((sum, source) => sum + source.table.rows.length, 0),
    });

    const analysis = await analyzeMigration(session.userId, job.id);
    return NextResponse.json({
      success: true,
      migrationId: job.id,
      state: analysis.state,
      planHash: analysis.plan.planHash,
      warnings: ingested.warnings,
      limits: {
        maxFiles: MIGRATION_LIMITS.maxFiles,
        maxRows: MIGRATION_LIMITS.maxTotalRows,
        maxFileMb: Math.round(MIGRATION_LIMITS.maxFileBytes / (1024 * 1024)),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Analysis failed.";
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "failed", error: message },
    });
    await recordMigrationEvent(session.userId, MIGRATION_EVENTS.failed, job.id, { reason: message.slice(0, 200) });
    // Nothing has been written to the workspace at this point — analysis only
    // ever touches migration tables — so it is safe to say so plainly.
    return NextResponse.json(
      {
        success: false,
        migrationId: job.id,
        message: "Rive could not read these files. Nothing was imported into your workspace.",
      },
      { status: 500 },
    );
  }
}
