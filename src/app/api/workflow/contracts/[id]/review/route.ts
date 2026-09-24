import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { buildContractReviewEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { agreementErrorResponse, AgreementActionError, assertContractsEnabled, createAccessToken, CONTRACT_TOKEN_TTL_DAYS, hashAccessToken, transitionContractStatus } from "@/utils/contracts";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { readJsonBody } from "@/utils/apiBoundary";

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const parsedBody = await readJsonBody(req, { allowEmpty: true });
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body as { sendEmail?: boolean; expiresInDays?: number };
    const contract = await prisma.contract.findFirst({
      where: { id, userId: session.userId },
      include: { client: { select: { name: true, email: true } }, user: { select: { name: true, email: true } }, versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!contract) return NextResponse.json({ success: false, message: "Agreement not found." }, { status: 404 });
    if (!["draft", "in_review", "expired"].includes(contract.status)) return NextResponse.json({ success: false, message: "Save requested changes as a new editable version before sharing it for review." }, { status: 409 });
    if (!contract.versions[0]) return NextResponse.json({ success: false, message: "Agreement has no draft version." }, { status: 409 });
    if (contract.versions[0].status === "final") return NextResponse.json({ success: false, message: "This version was already finalized for recorded acceptance. Re-finalize an expired request, or save a new version before review." }, { status: 409 });
    if (body.sendEmail === true && !contract.client.email) return NextResponse.json({ success: false, message: "Add the client’s email before sending a review invitation." }, { status: 400 });

    const requestedDays = Number(body.expiresInDays ?? CONTRACT_TOKEN_TTL_DAYS);
    const days = Number.isInteger(requestedDays) ? Math.min(Math.max(requestedDays, 1), 30) : CONTRACT_TOKEN_TTL_DAYS;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const token = createAccessToken();
    const tokenHash = hashAccessToken(token);
    const reviewUrl = `${appUrl()}/review/${encodeURIComponent(token)}`;
    const status = "in_review" as const;
    const clientEmail = contract.client.email;
    const shouldEmail = body.sendEmail === true && Boolean(clientEmail);
    let outboxId = "";
    await prisma.$transaction(async (tx) => {
      await tx.contractReviewLink.updateMany({ where: { contractId: id, type: "review", revokedAt: null }, data: { revokedAt: new Date() } });
      const link = await tx.contractReviewLink.create({ data: { contractId: id, versionId: contract.versions[0].id, tokenHash, type: "review", expiresAt } });
      const shared = await transitionContractStatus(tx, { where: { id, userId: session.userId }, from: contract.status, to: status, data: { reviewExpiresAt: expiresAt } });
      if (shared !== 1) throw new AgreementActionError("The Agreement changed while the review link was being created. Reload and try again.", 409);
      await tx.contractEvent.create({ data: { contractId: id, versionId: contract.versions[0].id, actorUserId: session.userId, eventType: "review_link_created", metadata: { expiresAt: expiresAt.toISOString(), emailed: shouldEmail } } });
      if (shouldEmail && clientEmail) {
        outboxId = await enqueueEmail({
          ...buildContractReviewEmail({ to: clientEmail, clientName: contract.client.name, ownerName: contract.user.name || session.email, contractTitle: contract.title, reviewUrl, expiresAt }),
          deliveryGuard: { kind: "contract_review", linkId: link.id, tokenHash },
        }, tx);
      }
    });

    let delivered = false;
    if (shouldEmail && outboxId && getEmailProvider() !== "disabled") {
      const outbox = await processEmailOutbox({ jobId: outboxId }).catch((deliveryError) => {
        console.error("Immediate Agreement review email attempt failed:", deliveryError);
        return null;
      });
      delivered = Boolean(outbox && outbox.sent > 0);
    }

    await recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.agreementReviewed, module: "agreements", entityType: "contract", entityId: id, source: "owner_review" });
    return NextResponse.json({
      success: true,
      reviewUrl,
      expiresAt,
      email: shouldEmail ? { queued: true, sent: delivered } : null,
      message: shouldEmail
        ? delivered
          ? "Review link created and emailed."
          : "Review link created. Share it if email delivery is still pending."
        : "Review link created.",
    });
  } catch (error) {
    return agreementErrorResponse(error, "Unable to create review link.", "Contract review link error");
  }
}
