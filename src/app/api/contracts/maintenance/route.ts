import { NextRequest, NextResponse } from "next/server";
import { processContractBilling } from "@/utils/contractBilling";
import { prisma } from "@/utils/db";
import { assertContractsEnabled, createNotification, transitionContractStatus } from "@/utils/contracts";
import { pruneExpiredRateLimitBuckets } from "@/utils/durableRateLimit";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    assertContractsEnabled();
  } catch {
    return NextResponse.json({ success: true, disabled: true, expiredContracts: 0, overdueInvoices: 0, billing: null });
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
        const count = await transitionContractStatus(tx, {
          where: { id: contract.id, reviewExpiresAt: { lte: now } },
          from: contract.status,
          to: "expired",
        });
        if (count !== 1) return false;
        await tx.contractReviewLink.updateMany({ where: { contractId: contract.id, revokedAt: null, expiresAt: { lte: now } }, data: { revokedAt: now } });
        await tx.contractEvent.create({ data: { contractId: contract.id, eventType: "contract_request_expired", metadata: { previousStatus: contract.status, expiredAt: now.toISOString() } } });
        return true;
      });
      if (!changed) continue;
      expired += 1;
      await createNotification({ userId: contract.userId, type: "contract_expired", title: "Agreement request expired", message: `${contract.title} needs a fresh ${contract.status === "signing" ? "acceptance" : "review"} request.`, href: `/workflow/contracts/${contract.id}` }).catch(() => undefined);
    }

    const overdue = await prisma.invoice.updateMany({
      where: { status: { in: ["sent", "viewed"] }, dueDate: { lt: now } },
      data: { status: "overdue" },
    });
    const billing = await processContractBilling({ limit: 500 });
    await pruneExpiredRateLimitBuckets().catch(() => undefined);
    return NextResponse.json({ success: billing.failed === 0, expiredContracts: expired, overdueInvoices: overdue.count, billing });
  } catch (error) {
    console.error("Contract billing maintenance error:", error);
    return NextResponse.json({ success: false, message: "Contract billing maintenance failed." }, { status: 500 });
  }
}
