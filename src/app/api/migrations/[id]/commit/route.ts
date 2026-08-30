import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { dispatchMigrationWork } from "@/utils/migration/dispatch";
import type { ImportPlan } from "@/lib/migration/types";

/**
 * Commit a reviewed migration.
 *
 * The client must send the plan hash it was shown. That is the entire
 * safeguard against previewing one result and importing another: if the hash
 * no longer matches, the commit is refused and the user is sent back to look.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) {
    return NextResponse.json({ success: false, message: "Migration is not available yet." }, { status: 404 });
  }
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`migration-commit:${session.userId}:${getRequestIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many import attempts. Try again later." }, { status: 429 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const planHash = typeof (body as { planHash?: unknown })?.planHash === "string"
    ? String((body as { planHash: string }).planHash)
    : "";
  if (!planHash) {
    return NextResponse.json({ success: false, message: "Review the import summary before importing." }, { status: 400 });
  }

  const job = await prisma.importJob.findFirst({
    where: { id, userId: session.userId, engineVersion: 2 },
    select: { status: true, planHash: true, plan: true, inputRevision: true },
  });
  if (!job) return NextResponse.json({ success: false, message: "Migration not found." }, { status: 404 });
  if (job.planHash !== planHash) {
    return NextResponse.json({ success: false, message: "This migration changed since you reviewed it. Review the current preview." }, { status: 409 });
  }
  const plan = job.plan as unknown as ImportPlan | null;
  if (!plan || plan.reviewItems.length > 0 || plan.blocked.length > 0) {
    return NextResponse.json({
      success: false,
      message: "Resolve or explicitly skip every uncertain and invalid row before importing.",
      unresolved: (plan?.reviewItems.length || 0) + (plan?.blocked.length || 0),
    }, { status: 409 });
  }

  const claimed = await prisma.importJob.updateMany({
    where: { id, userId: session.userId, status: { in: ["ready", "review_required"] }, planHash },
    data: {
      status: "queued_commit",
      phase: "queued_commit",
      progressCompleted: 0,
      progressTotal: plan.operations.length,
      failurePhase: null,
      failureCode: null,
      error: null,
      completedAt: null,
    },
  });
  if (claimed.count !== 1) {
    return NextResponse.json({ success: false, message: "This migration is already running or has been imported." }, { status: 409 });
  }

  try {
    const dispatched = await dispatchMigrationWork({
      migrationId: id,
      operation: "commit",
      inputRevision: job.inputRevision,
      planHash,
    });
    return NextResponse.json({
      success: true,
      migrationId: id,
      state: dispatched.queued ? "queued_commit" : dispatched.outcome?.status,
    }, { status: dispatched.queued ? 202 : 200 });
  } catch {
    await prisma.importJob.updateMany({
      where: { id, status: "queued_commit" },
      data: { status: "failed", phase: "recovery", failurePhase: "commit", failureCode: "enqueue_failed", error: "Commit could not be queued." },
    });
    return NextResponse.json({
      success: false,
      migrationId: id,
      message: "The import stopped safely. Retry the same plan to continue without duplicates.",
    }, { status: 500 });
  }
}
