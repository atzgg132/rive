import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { processContractBilling } from "@/utils/contractBilling";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => null) as { title?: unknown; dueDate?: unknown; completed?: unknown; acknowledgeContractSnapshot?: unknown } | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
    const hasTitle = Object.prototype.hasOwnProperty.call(body, "title");
    const hasDueDate = Object.prototype.hasOwnProperty.call(body, "dueDate");
    const hasCompleted = Object.prototype.hasOwnProperty.call(body, "completed");
    if (!hasTitle && !hasDueDate && !hasCompleted) return NextResponse.json({ success: false, message: "No milestone changes were provided." }, { status: 400 });
    if (hasTitle && typeof body.title !== "string") return NextResponse.json({ success: false, message: "Milestone title must be text." }, { status: 400 });
    if (hasCompleted && typeof body.completed !== "boolean") return NextResponse.json({ success: false, message: "Milestone completion must be true or false." }, { status: 400 });
    const milestone = await prisma.milestone.findFirst({ where: { id, project: { userId: session.userId } }, include: { project: { select: { id: true, title: true } } } });
    if (!milestone) return NextResponse.json({ success: false, message: "Milestone not found." }, { status: 404 });
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 180) : milestone.title;
    if (!title) return NextResponse.json({ success: false, message: "Milestone title is required." }, { status: 400 });
    let dueDate = milestone.dueDate;
    if (hasDueDate) {
      dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;
      if (dueDate && Number.isNaN(dueDate.getTime())) return NextResponse.json({ success: false, message: "Use a valid milestone due date." }, { status: 400 });
    }
    const completed = typeof body?.completed === "boolean" ? body.completed : milestone.completed;
    const linkedItems = await prisma.contractPaymentPlanItem.findMany({
      where: { milestoneId: id },
      select: {
        id: true,
        triggerType: true,
        contract: { select: { id: true, title: true, status: true } },
        occurrence: { select: { id: true, status: true, invoiceId: true } },
      },
    });
    const legallySnapshotted = linkedItems.filter((item) => item.contract.status !== "void");
    const scheduleChanged = title !== milestone.title || dueDate?.getTime() !== milestone.dueDate?.getTime();
    if (scheduleChanged && legallySnapshotted.length > 0 && body.acknowledgeContractSnapshot !== true) {
      return NextResponse.json({
        success: false,
        code: "CONTRACT_SNAPSHOT_ACKNOWLEDGEMENT_REQUIRED",
        message: `This milestone appears in ${legallySnapshotted.length} contract record${legallySnapshotted.length === 1 ? "" : "s"}. The project may change, but signed/finalized contract wording and billing dates will remain unchanged. Confirm that before updating the schedule.`,
      }, { status: 409 });
    }
    if (milestone.completed && !completed) {
      const lockedOccurrence = linkedItems.find((item) => item.occurrence?.invoiceId || ["processing", "draft_created"].includes(item.occurrence?.status || ""));
      if (lockedOccurrence) return NextResponse.json({ success: false, message: "This completion already triggered invoice processing. Keep the milestone complete and correct the invoice separately if needed." }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.milestone.update({ where: { id }, data: { title, dueDate, completed, completedAt: completed ? milestone.completedAt || new Date() : null } });
      if (milestone.completed && !completed) {
        await tx.contractBillingOccurrence.updateMany({
          where: { paymentPlanItem: { milestoneId: id }, invoiceId: null, status: { in: ["eligible", "pending"] } },
          data: { status: "pending", eligibleAt: null, lastError: null },
        });
      }
      return result;
    });
    const billing = await processContractBilling({ userId: session.userId, limit: 100 }).catch((error) => ({ error: error instanceof Error ? error.message : "Billing check failed." }));
    return NextResponse.json({ success: true, message: completed && !milestone.completed ? "Milestone completed. Any eligible contract invoice has been prepared as a draft for review." : "Milestone updated. Contract snapshots were not rewritten.", milestone: { id: updated.id, title: updated.title, due_date: updated.dueDate, completed: updated.completed, completed_at: updated.completedAt }, billing });
  } catch (error) {
    console.error("Milestone update error:", error);
    return NextResponse.json({ success: false, message: "Unable to update milestone." }, { status: 500 });
  }
}
