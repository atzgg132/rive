import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import {
  assertContractsEnabled,
  CONTRACT_TOKEN_TTL_DAYS,
  createAccessToken,
  getRequestIp,
  hashAccessToken,
  hashRequestValue,
  resetProjectCoverageIfNoActiveContracts,
  transitionContractStatus,
} from "@/utils/contracts";
import { sendContractVoidRequestedEmail } from "@/utils/email";

// Two-party void for an EXECUTED Agreement. Either party may request; the OTHER
// party must confirm. The existing DELETE /contracts/[id] still voids
// non-executed Agreements unilaterally; this route is the only way to void an
// accepted one, and only with both parties' recorded consent.

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const ip = getRequestIp(req);
    const body = await req.json().catch(() => null) as { action?: unknown; note?: unknown } | null;
    const action = typeof body?.action === "string" ? body.action : "";
    const note = clean(body?.note, 2_000);
    const requesterRole = "owner";

    const contract = await prisma.contract.findFirst({
      where: { id, userId: session.userId },
      include: {
        client: { select: { name: true, email: true } },
        user: { select: { name: true, email: true } },
        signers: { select: { id: true, role: true, name: true, email: true } },
        versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
      },
    });
    if (!contract) return NextResponse.json({ success: false, message: "Agreement not found." }, { status: 404 });
    if (contract.status !== "executed") {
      return NextResponse.json({ success: false, message: "Only an accepted Agreement can be voided through the two-party process." }, { status: 409 });
    }

    if (action === "request") {
      if (contract.voidRequestedAt) return NextResponse.json({ success: false, message: "A void request is already pending for this Agreement." }, { status: 409 });
      if (note.length < 5) return NextResponse.json({ success: false, message: "Add a short reason for the void request." }, { status: 400 });
      const clientSigner = contract.signers.find((signer) => signer.role === "client");
      const voidToken = clientSigner?.email ? createAccessToken() : null;
      const voidExpiresAt = voidToken ? new Date(Date.now() + CONTRACT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000) : null;
      await prisma.$transaction(async (tx) => {
        const updated = await tx.contract.updateMany({
          where: { id, userId: session.userId, voidRequestedAt: null, status: "executed" },
          data: { voidRequestedAt: new Date(), voidRequestedByRole: requesterRole, voidRequestNote: note, voidConfirmNote: null },
        });
        if (updated.count !== 1) throw new Error("A void request is already pending or the Agreement changed.");
        if (clientSigner && voidToken && voidExpiresAt) {
          await tx.contractReviewLink.updateMany({ where: { contractId: id, signerId: clientSigner.id, type: "void", revokedAt: null }, data: { revokedAt: new Date() } });
          await tx.contractReviewLink.create({ data: { contractId: id, versionId: contract.versions[0]?.id || null, signerId: clientSigner.id, tokenHash: hashAccessToken(voidToken), type: "void", expiresAt: voidExpiresAt } });
        }
        await tx.contractEvent.create({ data: { contractId: id, actorUserId: session.userId, eventType: "void_requested", metadata: { byRole: requesterRole, note }, ipHash: hashRequestValue(ip) } });
      });
      if (clientSigner?.email && voidToken) {
        await sendContractVoidRequestedEmail({ to: clientSigner.email, recipientName: clientSigner.name, contractTitle: contract.title, requesterName: contract.user.name || contract.user.email, note, voidUrl: `${appUrl()}/sign/${encodeURIComponent(voidToken)}` }).catch(() => undefined);
      }
      return NextResponse.json({ success: true, message: "Void requested. The client must confirm before the Agreement is voided." });
    }

    if (action === "confirm") {
      if (!contract.voidRequestedAt || contract.voidRequestedByRole !== "client") {
        return NextResponse.json({ success: false, message: "There is no void request from the client to confirm." }, { status: 409 });
      }
      if (note.length < 5) return NextResponse.json({ success: false, message: "Add a short confirmation note." }, { status: 400 });
      await prisma.$transaction(async (tx) => {
        const voided = await transitionContractStatus(tx, { where: { id, userId: session.userId, voidRequestedAt: { not: null }, voidRequestedByRole: "client" }, from: "executed", to: "void", data: { voidedAt: new Date(), voidConfirmNote: note } });
        if (voided !== 1) throw new Error("The Agreement changed before the void was confirmed.");
        await tx.contractReviewLink.updateMany({ where: { contractId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.contractEvent.create({ data: { contractId: id, actorUserId: session.userId, eventType: "void_confirmed", metadata: { confirmedByRole: requesterRole, requesterRole: "client", note }, ipHash: hashRequestValue(ip) } });
        await tx.contractEvent.create({ data: { contractId: id, eventType: "contract_voided", metadata: { via: "two_party", confirmedByRole: requesterRole, requesterRole: "client" } } });
        if (contract.projectId) await resetProjectCoverageIfNoActiveContracts(tx, contract.projectId, session.userId);
      });
      return NextResponse.json({ success: true, message: "Agreement voided. Its history is retained." });
    }

    if (action === "decline") {
      if (!contract.voidRequestedAt) {
        return NextResponse.json({ success: false, message: "There is no void request to decline." }, { status: 409 });
      }
      const requesterRoleSnapshot = contract.voidRequestedByRole;
      await prisma.$transaction(async (tx) => {
        const cleared = await tx.contract.updateMany({
          where: { id, userId: session.userId, voidRequestedAt: { not: null }, status: "executed" },
          data: { voidRequestedAt: null, voidRequestedByRole: null, voidRequestNote: null, voidConfirmNote: null },
        });
        if (cleared.count !== 1) throw new Error("The void request was already resolved.");
        await tx.contractReviewLink.updateMany({ where: { contractId: id, type: "void", revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.contractEvent.create({ data: { contractId: id, actorUserId: session.userId, eventType: "void_request_declined", metadata: { declinedByRole: requesterRole, requesterRole: requesterRoleSnapshot, note }, ipHash: hashRequestValue(ip) } });
      });
      return NextResponse.json({ success: true, message: "Void request declined. The Agreement remains accepted." });
    }

    return NextResponse.json({ success: false, message: "Unknown void action." }, { status: 400 });
  } catch (error) {
    console.error("Contract void error:", error);
    const message = error instanceof Error ? error.message : "Unable to process the void request.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
