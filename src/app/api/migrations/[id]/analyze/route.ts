import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { dispatchMigrationWork } from "@/utils/migration/dispatch";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) return NextResponse.json({ success: false }, { status: 404 });
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`migration-analyze:${session.userId}:${getRequestIp(req)}`, 40, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many analysis attempts. Try again shortly." }, { status: 429 });
  }
  const { id } = await context.params;
  const job = await prisma.importJob.findFirst({
    where: { id, userId: session.userId, engineVersion: 2 },
    include: { files: { select: { objectKey: true, uploadStatus: true } } },
  });
  if (!job) return NextResponse.json({ success: false, message: "Migration not found." }, { status: 404 });
  if (job.files.some((file) => file.objectKey && !["verified", "parsed", "superseded"].includes(file.uploadStatus))) {
    return NextResponse.json({ success: false, message: "Finish verifying every file before analysis." }, { status: 409 });
  }
  if (["completed", "completed_with_issues", "committing", "queued_commit"].includes(job.status)) {
    return NextResponse.json({ success: false, message: "This migration can no longer be analyzed." }, { status: 409 });
  }

  await prisma.importJob.update({
    where: { id },
    data: {
      status: "queued_analysis",
      phase: "queued_analysis",
      progressCompleted: 0,
      progressTotal: job.files.length,
      failurePhase: null,
      failureCode: null,
      error: null,
      completedAt: null,
    },
  });
  const input = { migrationId: id, operation: "analyze" as const, inputRevision: job.inputRevision };
  try {
    const dispatched = await dispatchMigrationWork(input);
    return NextResponse.json(
      { success: true, migrationId: id, state: dispatched.queued ? "queued_analysis" : dispatched.outcome?.status },
      { status: dispatched.queued ? 202 : 200 },
    );
  } catch {
    await prisma.importJob.updateMany({
      where: { id, status: { in: ["queued_analysis", "profiling"] } },
      data: { status: "failed", phase: "recovery", failurePhase: "analysis", failureCode: "enqueue_failed", error: "Analysis could not be queued." },
    });
    return NextResponse.json({ success: false, migrationId: id, message: "Analysis could not be queued. Retry safely." }, { status: 503 });
  }
}
