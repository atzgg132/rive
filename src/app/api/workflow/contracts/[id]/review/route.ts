import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { sendContractReviewEmail } from "@/utils/email";
import { assertContractsEnabled, createAccessToken, CONTRACT_TOKEN_TTL_DAYS, hashAccessToken } from "@/utils/contracts";

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const parsedBody = await req.json().catch(() => ({}));
    const body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody) ? parsedBody as { sendEmail?: boolean; expiresInDays?: number } : {};
    const contract = await prisma.contract.findFirst({
      where: { id, userId: session.userId },
      include: { client: { select: { name: true, email: true } }, user: { select: { name: true, email: true } }, versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!contract) return NextResponse.json({ success: false, message: "Contract not found." }, { status: 404 });
    if (!["draft", "in_review", "expired"].includes(contract.status)) return NextResponse.json({ success: false, message: "Save requested changes as a new editable version before sharing it for review." }, { status: 409 });
    if (!contract.versions[0]) return NextResponse.json({ success: false, message: "Contract has no draft version." }, { status: 409 });
    if (contract.versions[0].status === "final") return NextResponse.json({ success: false, message: "This version was already finalized for signing. Re-finalize an expired unsigned request, or save a new version before review." }, { status: 409 });
    if (body.sendEmail === true && !contract.client.email) return NextResponse.json({ success: false, message: "Add the client’s email before sending a review invitation." }, { status: 400 });

    const requestedDays = Number(body.expiresInDays ?? CONTRACT_TOKEN_TTL_DAYS);
    const days = Number.isInteger(requestedDays) ? Math.min(Math.max(requestedDays, 1), 30) : CONTRACT_TOKEN_TTL_DAYS;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const token = createAccessToken();
    const status = contract.status === "draft" || contract.status === "expired" ? "in_review" : contract.status;
    await prisma.$transaction(async (tx) => {
      await tx.contractReviewLink.updateMany({ where: { contractId: id, type: "review", revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.contractReviewLink.create({ data: { contractId: id, versionId: contract.versions[0].id, tokenHash: hashAccessToken(token), type: "review", expiresAt } });
      const shared = await tx.contract.updateMany({ where: { id, userId: session.userId, status: contract.status }, data: { status, reviewExpiresAt: expiresAt } });
      if (shared.count !== 1) throw new Error("The contract changed while the review link was being created. Reload and try again.");
      await tx.contractEvent.create({ data: { contractId: id, versionId: contract.versions[0].id, actorUserId: session.userId, eventType: "review_link_created", metadata: { expiresAt: expiresAt.toISOString(), emailed: body.sendEmail === true } } });
    });

    const reviewUrl = `${appUrl()}/review/${encodeURIComponent(token)}`;
    const email = body.sendEmail === true && contract.client.email
      ? await sendContractReviewEmail({ to: contract.client.email, clientName: contract.client.name, ownerName: contract.user.name || session.email, contractTitle: contract.title, reviewUrl, expiresAt })
      : null;
    return NextResponse.json({ success: true, reviewUrl, expiresAt, email: email ? { sent: email.sent, reason: email.reason } : null, message: body.sendEmail === true ? "Review link created and email attempted." : "Review link created." });
  } catch (error) {
    console.error("Contract review link error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unable to create review link." }, { status: 500 });
  }
}
