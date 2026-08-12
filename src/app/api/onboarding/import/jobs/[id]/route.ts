import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";

const ROLLBACKABLE = new Set(["completed", "completed_with_issues"]);
type ImportJobRouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: ImportJobRouteContext) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  const { id } = await context.params;
  const job = await prisma.importJob.findFirst({
    where: { id, userId: session.userId },
    include: {
      files: true,
      records: { orderBy: { createdAt: "asc" } },
      issues: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!job) return NextResponse.json({ success: false, message: "Import not found." }, { status: 404 });
  return NextResponse.json({ success: true, job });
}

export async function DELETE(req: NextRequest, context: ImportJobRouteContext) {
  const session = await getSessionUser(req);
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  if (!rateLimit(`import-rollback:${session.userId}:${getRequestIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many rollback attempts. Try again later." }, { status: 429 });
  }
  const { id } = await context.params;
  const job = await prisma.importJob.findFirst({
    where: { id, userId: session.userId },
    include: { records: { where: { action: "created" } } },
  });
  if (!job) return NextResponse.json({ success: false, message: "Import not found." }, { status: 404 });
  if (!ROLLBACKABLE.has(job.status) || job.rolledBackAt) {
    return NextResponse.json({ success: false, message: "This import cannot be rolled back." }, { status: 409 });
  }

  const ids = (targetType: string) => job.records
    .filter((record) => record.targetType === targetType)
    .map((record) => record.targetId);

  const deleted = await prisma.$transaction(async (transaction) => {
    const expenseIds = ids("expense");
    const invoiceIds = ids("invoice");
    const projectIds = ids("project");
    const clientIds = ids("client");

    const results = {
      expenses: expenseIds.length ? (await transaction.expense.deleteMany({ where: { id: { in: expenseIds }, userId: session.userId } })).count : 0,
      invoices: invoiceIds.length ? (await transaction.invoice.deleteMany({ where: { id: { in: invoiceIds }, userId: session.userId } })).count : 0,
      projects: projectIds.length ? (await transaction.project.deleteMany({ where: { id: { in: projectIds }, userId: session.userId } })).count : 0,
      clients: clientIds.length ? (await transaction.client.deleteMany({ where: { id: { in: clientIds }, userId: session.userId } })).count : 0,
    };

    await transaction.importJob.update({
      where: { id: job.id },
      data: {
        status: "rolled_back",
        phase: "rollback",
        rolledBackAt: new Date(),
        summary: { previous: job.summary, rollback: results },
      },
    });
    // Unique on (user, action): a second rollback would otherwise throw P2002
    // inside the transaction and undo a rollback that had already succeeded.
    await transaction.auditEvent.upsert({
      where: { userId_action: { userId: session.userId, action: "import.rolled_back" } },
      update: { targetId: job.id, metadata: results },
      create: {
        userId: session.userId,
        action: "import.rolled_back",
        targetType: "import_job",
        targetId: job.id,
        metadata: results,
      },
    });
    return results;
  });

  return NextResponse.json({ success: true, deleted });
}
