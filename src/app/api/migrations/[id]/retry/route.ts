import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { dispatchMigrationWork } from "@/utils/migration/dispatch";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) return NextResponse.json({ success: false }, { status: 404 });
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`migration-retry:${session.userId}:${getRequestIp(req)}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many retries. Wait a moment and try again." }, { status: 429 });
  }
  const { id } = await context.params;
  const job = await prisma.importJob.findFirst({
    where: { id, userId: session.userId, engineVersion: 2 },
    select: { status: true, failurePhase: true, inputRevision: true, planHash: true },
  });
  if (!job) return NextResponse.json({ success: false, message: "Migration not found." }, { status: 404 });
  if (job.status !== "failed" || !job.failurePhase) {
    return NextResponse.json({ success: false, message: "There is no failed phase to retry." }, { status: 409 });
  }
  if (job.failurePhase === "upload") {
    return NextResponse.json({ success: false, code: "replace_file", message: "Retry the affected file upload first." }, { status: 409 });
  }

  const operation = job.failurePhase === "commit" ? "commit" as const : "reanalyze" as const;
  if (operation === "commit" && !job.planHash) {
    return NextResponse.json({ success: false, message: "The approved plan is unavailable. Ask Rive for help." }, { status: 409 });
  }
  await prisma.importJob.update({
    where: { id },
    data: {
      status: operation === "commit" ? "queued_commit" : "queued_analysis",
      phase: operation === "commit" ? "queued_commit" : "queued_analysis",
      error: null,
      completedAt: null,
      workerLeaseId: null,
      workerLeaseExpiresAt: null,
    },
  });
  try {
    const dispatched = await dispatchMigrationWork({
      migrationId: id,
      operation,
      inputRevision: job.inputRevision,
      planHash: operation === "commit" ? job.planHash! : undefined,
    });
    return NextResponse.json({
      success: true,
      migrationId: id,
      state: dispatched.queued ? (operation === "commit" ? "queued_commit" : "queued_analysis") : dispatched.outcome?.status,
    }, { status: dispatched.queued ? 202 : 200 });
  } catch {
    await prisma.importJob.updateMany({
      where: { id, status: { in: ["queued_analysis", "queued_commit", "profiling"] } },
      data: { status: "failed", phase: "recovery", failurePhase: job.failurePhase, failureCode: "enqueue_failed", error: "The retry could not be queued." },
    });
    return NextResponse.json({ success: false, message: "The retry is still safely recoverable. Try again or ask Rive for help." }, { status: 500 });
  }
}
