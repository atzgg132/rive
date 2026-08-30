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
import {
  migrationObjectKey,
  migrationObjectStorageConfigured,
  presignMigrationUpload,
} from "@/utils/migration/uploads";

type FileManifest = { name: string; mimeType: string; sizeBytes: number; checksum: string };

const ACCEPTED_MIGRATION_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function parseFileManifests(value: unknown): FileManifest[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MIGRATION_LIMITS.maxFiles) return null;
  const manifests: FileManifest[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const raw = item as Record<string, unknown>;
    const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 240) : "";
    const mimeType = typeof raw.mimeType === "string" ? raw.mimeType.trim().toLowerCase().slice(0, 160) : "";
    const sizeBytes = Number(raw.sizeBytes);
    const checksum = typeof raw.checksum === "string" ? raw.checksum.trim().toLowerCase() : "";
    const extensionOk = /\.(csv|xlsx)$/i.test(name);
    if (!name || !extensionOk || !ACCEPTED_MIGRATION_MIME_TYPES.has(mimeType)
      || !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MIGRATION_LIMITS.maxFileBytes
      || !/^[a-f0-9]{64}$/.test(checksum)) return null;
    manifests.push({ name, mimeType, sizeBytes, checksum });
  }
  if (manifests.reduce((sum, file) => sum + file.sizeBytes, 0) > MIGRATION_LIMITS.maxTotalBytes) return null;
  return manifests;
}

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
      files: { where: { uploadStatus: { not: "superseded" } }, select: { name: true, sheetName: true, entity: true, rowCount: true } },
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

  if (req.headers.get("content-type")?.includes("application/json")) {
    if (!migrationObjectStorageConfigured()) {
      return NextResponse.json(
        { success: false, code: "durable_uploads_unavailable", message: "Durable uploads are not configured in this environment." },
        { status: 503 },
      );
    }
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const manifests = parseFileManifests(body?.files);
    if (!manifests) {
      return NextResponse.json({
        success: false,
        message: "Choose 1–10 CSV or XLSX files, up to 5 MB each and 20 MB total.",
      }, { status: 400 });
    }

    const priorCandidates = await prisma.importJob.findMany({
      where: {
        userId: session.userId,
        engineVersion: MIGRATION_ENGINE_VERSION,
        status: { notIn: ["abandoned", "rolled_back"] },
        files: { some: { checksum: { in: manifests.map((file) => file.checksum) } } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, status: true, completedAt: true, files: { select: { checksum: true, objectKey: true, uploadStatus: true } } },
    });
    const requestedChecksums = [...new Set(manifests.map((file) => file.checksum))].sort();
    const prior = priorCandidates.find((candidate) => {
      const priorChecksums = [...new Set(candidate.files
        .filter((file) => file.uploadStatus !== "superseded")
        .map((file) => file.checksum))].sort();
      return priorChecksums.length === requestedChecksums.length
        && priorChecksums.every((checksum, index) => checksum === requestedChecksums[index]);
    });
    if (prior && body?.confirmDuplicate !== true) {
      const complete = ["completed", "completed_with_issues"].includes(prior.status);
      return NextResponse.json({
        success: false,
        code: complete ? "identical_import_completed" : "identical_import_unfinished",
        migrationId: prior.id,
        state: prior.status,
        message: complete
          ? "These exact bytes were imported before. Review that result or confirm that you want to import them again."
          : "These exact bytes already belong to an unfinished migration. Resume it instead of uploading again.",
      }, { status: 409 });
    }

    const requestedCurrency = typeof body?.defaultCurrency === "string"
      ? body.defaultCurrency.trim().toUpperCase()
      : "";
    const defaultCurrency = isValidIsoCurrency(requestedCurrency) ? requestedCurrency : null;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const job = await prisma.$transaction(async (transaction) => {
      const created = await transaction.importJob.create({
        data: {
          userId: session.userId,
          engineVersion: MIGRATION_ENGINE_VERSION,
          source: "generic_tabular",
          sourceLabel: manifests.map((file) => file.name).join(", ").slice(0, 160),
          status: "uploading",
          phase: "upload",
          defaultCurrency,
          progressTotal: manifests.length,
        },
        select: { id: true },
      });
      const files = [];
      for (const manifest of manifests) {
        files.push(await transaction.importFile.create({
          data: {
            importJobId: created.id,
            ...manifest,
            objectKey: migrationObjectKey(session.userId, created.id, manifest.name),
            uploadStatus: "waiting",
            expiresAt,
            entity: "unknown",
            rowCount: 0,
            headers: [],
          },
          select: { id: true, name: true, mimeType: true, sizeBytes: true, checksum: true, objectKey: true },
        }));
      }
      return { id: created.id, files };
    });

    try {
      const uploads = await Promise.all(job.files.map(async (file) => ({
        fileId: file.id,
        name: file.name,
        ...(await presignMigrationUpload({
          name: file.name,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          checksum: file.checksum,
          objectKey: file.objectKey!,
        })),
      })));
      await recordMigrationEvent(session.userId, MIGRATION_EVENTS.started, job.id, {
        fileCount: manifests.length,
        migrationVersion: MIGRATION_ENGINE_VERSION,
      });
      return NextResponse.json({ success: true, migrationId: job.id, state: "uploading", uploads }, { status: 201 });
    } catch {
      await prisma.importJob.update({
        where: { id: job.id },
        data: { status: "failed", phase: "recovery", failurePhase: "upload", failureCode: "presign_failed" },
      });
      return NextResponse.json({ success: false, migrationId: job.id, message: "Upload preparation failed. Retry safely." }, { status: 503 });
    }
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
