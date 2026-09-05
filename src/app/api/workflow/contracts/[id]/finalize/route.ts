import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { assertContractsEnabled, transitionContractStatus } from "@/utils/contracts";
import { getEsignProvider } from "@/utils/esign";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const parsedBody = await req.json().catch(() => ({}));
    const body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
      ? parsedBody as { acknowledgeOpenComments?: boolean }
      : {};

    const contract = await prisma.contract.findFirst({
      where: { id, userId: session.userId },
      include: {
        client: { select: { name: true, email: true } },
        user: { select: { name: true, email: true } },
        versions: { orderBy: { version: "desc" }, take: 1, include: { signatures: { select: { id: true } } } },
        signers: { select: { role: true, name: true, email: true, status: true } },
        paymentPlanItems: { select: { label: true, currency: true, triggerType: true, triggerDate: true } },
      },
    });
    if (!contract) return NextResponse.json({ success: false, message: "Agreement not found." }, { status: 404 });
    if (contract.status === "ready_to_sign" || contract.status === "signing") return NextResponse.json({ success: true, message: "Agreement is already finalized for recorded acceptance.", status: contract.status });
    if (!["draft", "in_review", "expired"].includes(contract.status)) {
      return NextResponse.json({ success: false, message: `An Agreement in ${contract.status} cannot be finalized.` }, { status: 409 });
    }
    if (!contract.client.email) return NextResponse.json({ success: false, message: "Add the client’s email before finalizing the acceptance version." }, { status: 400 });
    if (!contract.versions[0]) return NextResponse.json({ success: false, message: "Agreement has no draft version." }, { status: 409 });
    if (contract.versions[0].signatures.length > 0) {
      return NextResponse.json({ success: false, message: "This exact version already has an acceptance record. Save the requested changes as a new version before finalizing again." }, { status: 409 });
    }
    if (contract.paymentPlanItems.some((item) => item.currency !== contract.currency)) {
      return NextResponse.json({ success: false, message: "Every payment must use the Agreement currency. Save a corrected version before finalizing." }, { status: 409 });
    }
    const unsnapshottedDueTrigger = contract.paymentPlanItems.find((item) => item.triggerType === "milestone_due" && !item.triggerDate);
    if (unsnapshottedDueTrigger) {
      return NextResponse.json({ success: false, message: `“${unsnapshottedDueTrigger.label}” does not have an agreed milestone due-date snapshot. Edit and save a new version before finalizing.` }, { status: 409 });
    }
    const openCommentCount = await prisma.contractComment.count({
      where: { contractId: id, versionId: contract.versions[0].id, status: "open" },
    });
    if (openCommentCount > 0 && body.acknowledgeOpenComments !== true) {
      return NextResponse.json({
        success: false,
        code: "OPEN_REVIEW_COMMENTS",
        openCommentCount,
        message: `${openCommentCount} review comment${openCommentCount === 1 ? " is" : "s are"} still open. Resolve them or explicitly finalize with open comments.`,
      }, { status: 409 });
    }
    const clientSigner = contract.signers.find((signer) => signer.role === "client");
    const ownerSigner = contract.signers.find((signer) => signer.role === "owner");
    if (contract.signers.length !== 2 || !clientSigner || !ownerSigner) {
      return NextResponse.json({ success: false, message: "An Agreement must have exactly the client and owner as acceptance parties." }, { status: 409 });
    }
    const ownerName = contract.user.name || contract.user.email;
    if (clientSigner.name.trim() !== contract.client.name.trim() || clientSigner.email.trim().toLowerCase() !== contract.client.email.trim().toLowerCase()) {
      return NextResponse.json({
        success: false,
        message: `The client on this draft is snapshotted as “${clientSigner.name} <${clientSigner.email}>”, but the live client is now “${contract.client.name} <${contract.client.email || "missing email"}”. Edit the Agreement and save a new version before finalizing.`,
      }, { status: 409 });
    }
    if (ownerSigner.name.trim() !== ownerName.trim() || ownerSigner.email.trim().toLowerCase() !== contract.user.email.trim().toLowerCase()) {
      return NextResponse.json({
        success: false,
        message: `The owner on this draft is snapshotted as “${ownerSigner.name} <${ownerSigner.email}>”, but the live owner is now “${ownerName} <${contract.user.email}>”. Edit the Agreement and save a new version before finalizing.`,
      }, { status: 409 });
    }

    if (contract.status === "expired" && contract.providerEnvelopeId) {
      try {
        await getEsignProvider().voidEnvelope(contract.providerEnvelopeId);
      } catch (error) {
        console.error("Expired contract envelope cleanup error:", error);
        return NextResponse.json({ success: false, message: "The previous recorded-acceptance request could not be closed with the configured provider. Retry after the provider is available." }, { status: 502 });
      }
    }

    await prisma.$transaction(async (tx) => {
      const finalized = await transitionContractStatus(tx, { where: { id, userId: session.userId }, from: contract.status, to: "ready_to_sign", data: { finalizedAt: new Date(), reviewExpiresAt: null, ...(contract.status === "expired" ? { providerEnvelopeId: null } : {}) } });
      if (finalized !== 1) throw new Error("The Agreement changed while it was being finalized. Reload and try again.");
      await tx.contractVersion.update({ where: { id: contract.versions[0].id }, data: { status: "final", finalizedAt: new Date() } });
      await tx.contractReviewLink.updateMany({ where: { contractId: id, type: "review", revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.contractEvent.create({ data: { contractId: id, versionId: contract.versions[0].id, actorUserId: session.userId, eventType: "contract_finalized", metadata: { version: contract.versions[0].version, openCommentsAcknowledged: openCommentCount } } });
    });
    await recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.agreementDraftReviewed, module: "contracts", entityType: "contract", entityId: id, dataOrigin: "user" });
    return NextResponse.json({ success: true, status: "ready_to_sign", version: contract.versions[0].version, message: "Agreement version finalized. Start recorded acceptance when you are ready." });
  } catch (error) {
    console.error("Contract finalize error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unable to finalize Agreement." }, { status: 500 });
  }
}
