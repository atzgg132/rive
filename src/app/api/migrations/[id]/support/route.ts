import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { migrationEngineAvailable } from "@/utils/migration/config";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) return NextResponse.json({ success: false }, { status: 404 });
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const contactAllowed = body?.contactAllowed === true;
  const reference = `RIVE-MIG-${id.slice(-8).toUpperCase()}`;

  const job = await prisma.importJob.findFirst({
    where: { id, userId: session.userId, engineVersion: 2 },
    select: {
      id: true, status: true, phase: true, failurePhase: true, failureCode: true,
      createdRecords: true, skippedRecords: true, progressCompleted: true, progressTotal: true,
      supportRequestedAt: true,
    },
  });
  if (!job) return NextResponse.json({ success: false, message: "Migration not found." }, { status: 404 });
  if (job.supportRequestedAt) {
    return NextResponse.json({ success: true, reference, existing: true });
  }

  await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.importJob.updateMany({
      where: { id, userId: session.userId, supportRequestedAt: null },
      data: { supportRequestedAt: new Date() },
    });
    if (!claimed.count) return;
    await transaction.feedback.create({
      data: {
        userId: session.userId,
        promptKey: `migration-support:${id}`,
        feedbackType: "migration_support",
        module: "migration",
        triggerEvent: "migration_failed",
        contactAllowed,
        tags: ["migration", "support"],
        body: `Migration assistance requested. Reference ${reference}.`,
        context: {
          migrationId: id,
          reference,
          status: job.status,
          phase: job.phase,
          failurePhase: job.failurePhase,
          failureCode: job.failureCode,
          createdCount: job.createdRecords,
          skippedCount: job.skippedRecords,
          completedCount: job.progressCompleted,
          totalCount: job.progressTotal,
        } as Prisma.InputJsonValue,
      },
    });
  });
  return NextResponse.json({ success: true, reference });
}
