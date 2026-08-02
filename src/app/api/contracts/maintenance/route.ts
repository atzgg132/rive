import { NextRequest, NextResponse } from "next/server";
import { processContractBilling } from "@/utils/contractBilling";
import { prisma } from "@/utils/db";
import { createNotification } from "@/utils/contracts";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const now = new Date();
    const expiredCandidates = await prisma.contract.findMany({
      where: { status: { in: ["in_review", "signing"] }, reviewExpiresAt: { lte: now } },
      orderBy: { reviewExpiresAt: "asc" },
      take: 500,
      select: { id: true, userId: true, title: true, status: true },
    });
    let expired = 0;
    for (const contract of expiredCandidates) {
      const changed = await prisma.$transaction(async (tx) => {
        const update = await tx.contract.updateMany({
          where: { id: contract.id, status: contract.status, reviewExpiresAt: { lte: now } },
          data: { status: "expired" },
        });
        if (update.count !== 1) return false;
        await tx.contractReviewLink.updateMany({ where: { contractId: contract.id, revokedAt: null, expiresAt: { lte: now } }, data: { revokedAt: now } });
        await tx.contractEvent.create({ data: { contractId: contract.id, eventType: "contract_request_expired", metadata: { previousStatus: contract.status, expiredAt: now.toISOString() } } });
        return true;
      });
      if (!changed) continue;
      expired += 1;
      await createNotification({ userId: contract.userId, type: "contract_expired", title: "Contract request expired", message: `${contract.title} needs a fresh ${contract.status === "signing" ? "signing" : "review"} request.`, href: `/workflow/contracts/${contract.id}` }).catch(() => undefined);
    }

    const overdue = await prisma.invoice.updateMany({
      where: { status: { in: ["sent", "viewed"] }, dueDate: { lt: now } },
      data: { status: "overdue" },
    });
    const billing = await processContractBilling({ limit: 500 });
    return NextResponse.json({ success: billing.failed === 0, expiredContracts: expired, overdueInvoices: overdue.count, billing });
  } catch (error) {
    console.error("Contract billing maintenance error:", error);
    return NextResponse.json({ success: false, message: "Contract billing maintenance failed." }, { status: 500 });
  }
}
