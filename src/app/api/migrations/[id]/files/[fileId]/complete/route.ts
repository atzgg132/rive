import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { markMigrationObjectVerified, migrationObjectKey, presignMigrationUpload, verifyMigrationObject } from "@/utils/migration/uploads";
import { MIGRATION_LIMITS } from "@/lib/migration/config";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string; fileId: string }> };

async function ownedFile(userId: string, id: string, fileId: string) {
  return prisma.importFile.findFirst({
    where: { id: fileId, importJobId: id, importJob: { userId, engineVersion: 2 } },
  });
}

function contentLooksValid(name: string, bytes: Uint8Array): boolean {
  if (/\.xlsx$/i.test(name)) return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4_096));
  return !sample.includes(0);
}

/** Verify one independently uploaded object before it can enter analysis. */
export async function POST(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) return NextResponse.json({ success: false }, { status: 404 });
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id, fileId } = await context.params;
  const file = await ownedFile(session.userId, id, fileId);
  if (!file?.objectKey) return NextResponse.json({ success: false, message: "Upload not found." }, { status: 404 });
  if (file.uploadStatus === "verified") return NextResponse.json({ success: true, state: "verified" });

  try {
    const bytes = await verifyMigrationObject({ objectKey: file.objectKey, checksum: file.checksum, sizeBytes: file.sizeBytes });
    if (!contentLooksValid(file.name, bytes)) throw new Error("The uploaded file content does not match its filename.");
    await markMigrationObjectVerified(file.objectKey);
    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.importFile.updateMany({
        where: { id: file.id, uploadStatus: { not: "verified" } },
        data: { uploadStatus: "verified", uploadedAt: new Date(), uploadError: null },
      });
      if (claimed.count) {
        await transaction.importJob.update({
          where: { id },
          data: { progressCompleted: { increment: 1 }, lastHeartbeatAt: new Date() },
        });
      }
    });
    return NextResponse.json({ success: true, state: "verified" });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 240) : "Upload verification failed.";
    await prisma.$transaction([
      prisma.importFile.update({ where: { id: file.id }, data: { uploadStatus: "failed", uploadError: message } }),
      prisma.importJob.update({
        where: { id },
        data: { status: "failed", phase: "recovery", failurePhase: "upload", failureCode: "upload_verification_failed", error: message },
      }),
    ]);
    return NextResponse.json({ success: false, code: "upload_verification_failed", message }, { status: 409 });
  }
}

/** Refresh the short-lived URL for only the file that needs another transfer. */
export async function PUT(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) return NextResponse.json({ success: false }, { status: 404 });
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id, fileId } = await context.params;
  const file = await ownedFile(session.userId, id, fileId);
  if (!file?.objectKey) return NextResponse.json({ success: false, message: "Upload not found." }, { status: 404 });
  if (!["waiting", "uploading", "failed"].includes(file.uploadStatus)) {
    return NextResponse.json({ success: false, message: "This file is already verified." }, { status: 409 });
  }
  const instruction = await presignMigrationUpload({
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    checksum: file.checksum,
    objectKey: file.objectKey,
  });
  await prisma.importFile.update({ where: { id: file.id }, data: { uploadStatus: "waiting", uploadError: null } });
  return NextResponse.json({ success: true, fileId: file.id, name: file.name, ...instruction });
}

/** Replace one pre-commit file while retaining every verified sibling file. */
export async function PATCH(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) return NextResponse.json({ success: false }, { status: 404 });
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id, fileId } = await context.params;
  const file = await ownedFile(session.userId, id, fileId);
  if (!file) return NextResponse.json({ success: false, message: "Upload not found." }, { status: 404 });
  const applied = await prisma.migrationOperation.count({ where: { importJobId: id, status: "applied" } });
  if (applied > 0) return NextResponse.json({ success: false, message: "Files cannot change after commit begins." }, { status: 409 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 240) : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType.trim().toLowerCase().slice(0, 160) : "";
  const sizeBytes = Number(body?.sizeBytes);
  const checksum = typeof body?.checksum === "string" ? body.checksum.trim().toLowerCase() : "";
  if (!/\.(csv|xlsx)$/i.test(name) || !Number.isInteger(sizeBytes) || sizeBytes < 1
    || sizeBytes > MIGRATION_LIMITS.maxFileBytes || !/^[a-f0-9]{64}$/.test(checksum)) {
    return NextResponse.json({ success: false, message: "Choose a CSV or XLSX file up to 5 MB." }, { status: 400 });
  }
  const siblingFiles = await prisma.importFile.findMany({
    where: { importJobId: id, uploadStatus: { not: "superseded" } },
    select: { objectKey: true, sizeBytes: true },
  });
  const retainedBytes = Array.from(new Map(siblingFiles
    .filter((candidate) => candidate.objectKey && candidate.objectKey !== file.objectKey)
    .map((candidate) => [candidate.objectKey!, candidate.sizeBytes])).values())
    .reduce((sum, bytes) => sum + bytes, 0);
  if (retainedBytes + sizeBytes > MIGRATION_LIMITS.maxTotalBytes) {
    return NextResponse.json({ success: false, message: "The replacement would put this migration over the 20 MB total limit." }, { status: 400 });
  }
  const objectKey = migrationObjectKey(session.userId, id, name);
  await prisma.$transaction([
    prisma.importFile.update({
      where: { id: file.id },
      data: {
        name, mimeType, sizeBytes, checksum, objectKey, uploadStatus: "waiting", uploadedAt: null,
        uploadError: null, sourceId: null, entity: "unknown", rowCount: 0, headers: [], rows: Prisma.DbNull,
      },
    }),
    ...(file.objectKey ? [prisma.importFile.updateMany({
      where: { importJobId: id, objectKey: file.objectKey, id: { not: file.id } },
      data: { uploadStatus: "superseded" },
    })] : []),
    prisma.importJob.update({
      where: { id },
      data: {
        status: "uploading", phase: "upload", inputRevision: { increment: 1 }, plan: Prisma.DbNull, planHash: null,
        failurePhase: null, failureCode: null, error: null, completedAt: null,
      },
    }),
  ]);
  const instruction = await presignMigrationUpload({ name, mimeType, sizeBytes, checksum, objectKey });
  return NextResponse.json({ success: true, fileId, name, ...instruction });
}
