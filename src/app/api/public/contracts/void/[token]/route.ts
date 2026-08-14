import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/utils/db";
import {
  assertContractsEnabled,
  classifyContractPublicLinkFailure,
  CONTRACT_TOKEN_TTL_DAYS,
  createAccessToken,
  createNotification,
  getRequestId,
  getRequestIp,
  hashAccessToken,
  hashRequestValue,
  logContractPublicLinkAccess,
  resetProjectCoverageIfNoActiveContracts,
  transitionContractStatus,
} from "@/utils/contracts";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { sendContractVoidRequestedEmail } from "@/utils/email";

// Client-party entry to the two-party void flow. The signer reaches this via
// their existing sign-type acceptance link; the link resolves to the signer
// whose `role` is the requesting/confirming party. Self-confirmation is blocked:
// a confirmer's role must differ from `voidRequestedByRole`.

async function resolveLink(token: string) {
  return prisma.contractReviewLink.findUnique({
    where: { tokenHash: hashAccessToken(token) },
    include: {
      contract: { include: { client: { select: { name: true, email: true } }, user: { select: { name: true, email: true } }, signers: { select: { id: true, role: true, name: true, email: true } } } },
      signer: true,
    },
  });
}

function invalidLink(link: Awaited<ReturnType<typeof resolveLink>>): string | null {
  if (!link || !["sign", "void"].includes(link.type)) return "Acceptance link not found.";
  if (link.revokedAt) return "This acceptance link has been revoked.";
  if (link.expiresAt <= new Date()) return "This acceptance link has expired. Ask the sender to reissue it.";
  if (!link.signer) return "This acceptance link is incomplete.";
  if (link.contract.status !== "executed") return "This Agreement is not eligible for voiding through this link.";
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;
    const link = await resolveLink(token);
    const problem = invalidLink(link);
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      return NextResponse.json({ success: false, message: problem }, { status: problem.includes("not found") ? 404 : 410 });
    }
    const ip = getRequestIp(req);
    if (!(await durableRateLimit(`contract-void:${link!.id}:${hashRequestValue(ip)}`, 10, 60 * 60 * 1000))) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: "rate_limited", revoked: false, expired: false, rateLimited: true });
      return NextResponse.json({ success: false, message: "Too many void attempts. Try again later." }, { status: 429 });
    }
    const body = await req.json().catch(() => null) as { action?: unknown; note?: unknown } | null;
    const action = typeof body?.action === "string" ? body.action : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2_000) : "";
    const contract = link!.contract;
    const signer = link!.signer!;
    const requesterRole = signer.role;

    if (action === "request") {
      if (link!.type !== "sign") return NextResponse.json({ success: false, message: "This link can only be used to confirm or decline a void request." }, { status: 409 });
      if (contract.voidRequestedAt) return NextResponse.json({ success: false, message: "A void request is already pending." }, { status: 409 });
      if (note.length < 5) return NextResponse.json({ success: false, message: "Add a short reason for the void request." }, { status: 400 });
      const confirmationRole = requesterRole === "client" ? "owner" : "client";
      const confirmationSigner = contract.signers.find((candidate) => candidate.role === confirmationRole);
      const voidToken = confirmationSigner?.email ? createAccessToken() : null;
      const voidExpiresAt = voidToken ? new Date(Date.now() + CONTRACT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000) : null;
      await prisma.$transaction(async (tx) => {
        const updated = await tx.contract.updateMany({ where: { id: contract.id, voidRequestedAt: null, status: "executed" }, data: { voidRequestedAt: new Date(), voidRequestedByRole: requesterRole, voidRequestNote: note, voidConfirmNote: null } });
        if (updated.count !== 1) throw new Error("A void request is already pending or the Agreement changed.");
        if (confirmationSigner && voidToken && voidExpiresAt) {
          await tx.contractReviewLink.updateMany({ where: { contractId: contract.id, signerId: confirmationSigner.id, type: "void", revokedAt: null }, data: { revokedAt: new Date() } });
          await tx.contractReviewLink.create({ data: { contractId: contract.id, versionId: link!.versionId, signerId: confirmationSigner.id, tokenHash: hashAccessToken(voidToken), type: "void", expiresAt: voidExpiresAt } });
        }
        await tx.contractEvent.create({ data: { contractId: contract.id, eventType: "void_requested", metadata: { byRole: requesterRole, note }, ipHash: hashRequestValue(ip) } });
      });
      await createNotification({ userId: contract.userId, type: "contract_void_requested", title: "Void requested", message: `${signer.name} requested to void ${contract.title}.`, href: `/workflow/contracts/${contract.id}` }).catch(() => undefined);
      if (confirmationSigner?.email && voidToken) {
        const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
        await sendContractVoidRequestedEmail({ to: confirmationSigner.email, recipientName: confirmationSigner.name, contractTitle: contract.title, requesterName: signer.name, note, voidUrl: `${baseUrl}/sign/${encodeURIComponent(voidToken)}` }).catch(() => undefined);
      }
      return NextResponse.json({ success: true, message: "Void requested. The other party must confirm before the Agreement is voided." });
    }

    if (action === "confirm") {
      if (!contract.voidRequestedAt || !contract.voidRequestedByRole || contract.voidRequestedByRole === requesterRole) {
        return NextResponse.json({ success: false, message: "There is no void request from the other party to confirm." }, { status: 409 });
      }
      if (note.length < 5) return NextResponse.json({ success: false, message: "Add a short confirmation note." }, { status: 400 });
      const requesterRoleSnapshot = contract.voidRequestedByRole;
      await prisma.$transaction(async (tx) => {
        const voided = await transitionContractStatus(tx, { where: { id: contract.id, status: "executed", voidRequestedAt: { not: null }, voidRequestedByRole: requesterRoleSnapshot }, from: "executed", to: "void", data: { voidedAt: new Date(), voidConfirmNote: note } });
        if (voided !== 1) throw new Error("The Agreement changed before the void was confirmed.");
        await tx.contractReviewLink.updateMany({ where: { contractId: contract.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.contractEvent.create({ data: { contractId: contract.id, eventType: "void_confirmed", metadata: { confirmedByRole: requesterRole, requesterRole: requesterRoleSnapshot, note }, ipHash: hashRequestValue(ip) } });
        await tx.contractEvent.create({ data: { contractId: contract.id, eventType: "contract_voided", metadata: { via: "two_party", confirmedByRole: requesterRole, requesterRole: requesterRoleSnapshot } } });
        if (contract.projectId) await resetProjectCoverageIfNoActiveContracts(tx, contract.projectId, contract.userId);
      });
      return NextResponse.json({ success: true, message: "Agreement voided. Its history is retained." });
    }

    if (action === "decline") {
      if (!contract.voidRequestedAt) {
        return NextResponse.json({ success: false, message: "There is no void request to decline." }, { status: 409 });
      }
      const requesterRoleSnapshot = contract.voidRequestedByRole;
      await prisma.$transaction(async (tx) => {
        const cleared = await tx.contract.updateMany({ where: { id: contract.id, voidRequestedAt: { not: null }, status: "executed" }, data: { voidRequestedAt: null, voidRequestedByRole: null, voidRequestNote: null, voidConfirmNote: null } });
        if (cleared.count !== 1) throw new Error("The void request was already resolved.");
        await tx.contractReviewLink.updateMany({ where: { contractId: contract.id, type: "void", revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.contractEvent.create({ data: { contractId: contract.id, eventType: "void_request_declined", metadata: { declinedByRole: requesterRole, requesterRole: requesterRoleSnapshot, note }, ipHash: hashRequestValue(ip) } });
      });
      return NextResponse.json({ success: true, message: "Void request declined. The Agreement remains accepted." });
    }

    return NextResponse.json({ success: false, message: "Unknown void action." }, { status: 400 });
  } catch (error) {
    console.error("Public contract void error:", error);
    const message = error instanceof Error ? error.message : "Unable to process the void request.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
