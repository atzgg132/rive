import { NextRequest, NextResponse } from "next/server";
import { processContractBilling } from "@/utils/contractBilling";
import { prisma } from "@/utils/db";
import { assertContractsEnabled, createNotification, transitionContractStatus } from "@/utils/contracts";
import { pruneExpiredRateLimitBuckets } from "@/utils/durableRateLimit";
import { refreshOverdueInvoices } from "@/utils/invoiceLifecycle";
import { notifyOwnerAcceptanceDue } from "@/utils/agreementAcceptance";

const OWNER_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

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

    // Once the client has accepted, only the owner is outstanding — and the
    // owner accepts in the workspace, not through an expiring link. Expiring
    // here would throw away the client's acceptance, so remind the owner once
    // a day instead (the next reminder is scheduled via reviewExpiresAt).
    const awaitingOwner = await prisma.contract.findMany({
      where: {
        status: "signing",
        reviewExpiresAt: { lte: now },
        signers: { some: { role: "client", status: "signed" } },
        AND: [{ signers: { some: { role: "owner", status: "pending" } } }],
      },
      take: 500,
      select: { id: true, userId: true, title: true, client: { select: { name: true } }, user: { select: { name: true, email: true } } },
    });
    let ownerReminders = 0;
    for (const contract of awaitingOwner) {
      const scheduled = await prisma.contract.updateMany({
        where: { id: contract.id, status: "signing", reviewExpiresAt: { lte: now } },
        data: { reviewExpiresAt: new Date(now.getTime() + OWNER_REMINDER_INTERVAL_MS) },
      });
      if (scheduled.count !== 1) continue;
      ownerReminders += 1;
      await notifyOwnerAcceptanceDue({ contractId: contract.id, userId: contract.userId, title: contract.title, clientName: contract.client.name, ownerName: contract.user.name || contract.user.email, ownerEmail: contract.user.email, reminder: true });
    }

    // A start-signing request that crashed between claiming "starting" and
    // committing "signing" would otherwise sit there until the owner retried.
    const staleStarts = await prisma.contract.findMany({
      where: { status: "starting", updatedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) } },
      take: 500,
      select: { id: true, updatedAt: true },
    });
    let recoveredStarts = 0;
    for (const contract of staleStarts) {
      recoveredStarts += await transitionContractStatus(prisma, { where: { id: contract.id, updatedAt: contract.updatedAt }, from: "starting", to: "ready_to_sign" });
    }

    const expiredCandidates = await prisma.contract.findMany({
      where: {
        status: { in: ["in_review", "signing"] },
        reviewExpiresAt: { lte: now },
        NOT: { signers: { some: { role: "client", status: "signed" } } },
      },
      orderBy: { reviewExpiresAt: "asc" },
      take: 500,
      select: { id: true, userId: true, title: true, status: true },
    });
    let expired = 0;
    for (const contract of expiredCandidates) {
      const changed = await prisma.$transaction(async (tx) => {
        const count = await transitionContractStatus(tx, {
          where: { id: contract.id, reviewExpiresAt: { lte: now }, NOT: { signers: { some: { role: "client", status: "signed" } } } },
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

    const overdueCount = await refreshOverdueInvoices();
    const billing = await processContractBilling({ limit: 500 });
    await pruneExpiredRateLimitBuckets().catch(() => undefined);
    // Public sessions are bearer artifacts, not audit data — once expired they
    // only grow the table. Keep a day's tail for incident correlation, then prune.
    await prisma.contractPublicSession.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    }).catch(() => undefined);
    return NextResponse.json({ success: billing.failed === 0, expiredContracts: expired, ownerReminders, recoveredStarts, overdueInvoices: overdueCount, billing });
  } catch (error) {
    console.error("Contract billing maintenance error:", error);
    return NextResponse.json({ success: false, message: "Contract billing maintenance failed." }, { status: 500 });
  }
}
