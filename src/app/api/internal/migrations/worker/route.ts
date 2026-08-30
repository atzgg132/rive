import { NextRequest, NextResponse } from "next/server";
import { parseMigrationWorkMessage } from "@/utils/migration/queue";
import { processMigrationWork } from "@/utils/migration/worker";
import { prisma } from "@/utils/db";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  const message = parseMigrationWorkMessage(await request.json().catch(() => null));
  if (!message) return NextResponse.json({ success: false, message: "Invalid migration work message." }, { status: 400 });
  const startedAt = Date.now();

  try {
    const outcome = await processMigrationWork(message);
    const job = await prisma.importJob.findUnique({
      where: { id: message.migrationId },
      select: { phase: true, attemptCount: true, progressCompleted: true, progressTotal: true, createdRecords: true, skippedRecords: true },
    });
    console.info(JSON.stringify({
      event: "migration_worker_completed",
      migrationId: message.migrationId,
      operation: message.operation,
      phase: job?.phase || outcome.status,
      attempt: job?.attemptCount || 0,
      durationMs: Date.now() - startedAt,
      completedCount: job?.progressCompleted || 0,
      totalCount: job?.progressTotal || 0,
      createdCount: job?.createdRecords || 0,
      skippedCount: job?.skippedRecords || 0,
    }));
    if (!outcome.accepted) return NextResponse.json({ success: false, ...outcome }, { status: 409 });
    return NextResponse.json({ success: true, ...outcome });
  } catch (error) {
    const job = await prisma.importJob.findUnique({
      where: { id: message.migrationId },
      select: { phase: true, attemptCount: true, progressCompleted: true, progressTotal: true, createdRecords: true, skippedRecords: true },
    }).catch(() => null);
    console.error(JSON.stringify({
      event: "migration_worker_failed",
      migrationId: message.migrationId,
      operation: message.operation,
      phase: job?.phase || "worker",
      attempt: job?.attemptCount || 0,
      durationMs: Date.now() - startedAt,
      completedCount: job?.progressCompleted || 0,
      totalCount: job?.progressTotal || 0,
      createdCount: job?.createdRecords || 0,
      skippedCount: job?.skippedRecords || 0,
      error: error instanceof Error ? error.name : "unknown",
    }));
    return NextResponse.json({ success: false, message: "Migration work failed and will be retried." }, { status: 500 });
  }
}
