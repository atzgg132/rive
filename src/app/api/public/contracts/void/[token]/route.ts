import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/utils/db";
import {
  agreementErrorResponse,
  AgreementActionError,
  assertContractsEnabled,
  classifyContractPublicLinkFailure,
  createNotification,
  getRequestId,
  getRequestIp,
  hashAccessToken,
  hashRequestValue,
  logContractPublicLinkAccess,
} from "@/utils/contracts";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { getEmailProvider } from "@/utils/email";
import { processEmailOutbox } from "@/utils/emailOutbox";
import {
  contractPublicSessionLogOutcome,
  contractPublicSessionMessage,
  contractVoidLinkProblem,
  isContractPublicSessionSegment,
  readContractPublicSessionToken,
  resolveContractPublicSession,
} from "@/utils/contractPublicSession";
import { clearAgreementVoidRequest, completeAgreementVoid, queueOwnerVoidRequest } from "@/utils/agreementVoid";
import { readJsonBody } from "@/utils/apiBoundary";

// Client-party entry to the two-party void flow. The client reaches this from
// their accepted-record link (a sign link) or from a void-confirmation link the
// owner's request emailed them. Owner links are refused upstream
// (contractVoidLinkProblem): the owner requests and confirms in the workspace.
// The reserved "session" segment resolves the same link through the
// acceptance-purpose public-session cookie.

const LINK_INCLUDE = {
  contract: { include: { user: { select: { name: true, email: true } } } },
  signer: true,
} satisfies Prisma.ContractReviewLinkInclude;

async function resolveLink(token: string) {
  return prisma.contractReviewLink.findUnique({
    where: { tokenHash: hashAccessToken(token) },
    include: LINK_INCLUDE,
  });
}

async function resolveLinkById(id: string) {
  return prisma.contractReviewLink.findUnique({
    where: { id },
    include: LINK_INCLUDE,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;
    let link: Awaited<ReturnType<typeof resolveLink>> | Awaited<ReturnType<typeof resolveLinkById>>;
    if (isContractPublicSessionSegment(token)) {
      const resolved = await resolveContractPublicSession(prisma, {
        purpose: "acceptance",
        token: readContractPublicSessionToken(req, "acceptance"),
      });
      if (!resolved.ok) {
        logContractPublicLinkAccess({
          request: req,
          requestId,
          purpose: "acceptance",
          contractId: resolved.session?.contractId || null,
          versionId: resolved.session?.versionId || null,
          outcome: contractPublicSessionLogOutcome(resolved.reason),
          revoked: resolved.reason === "revoked" || resolved.reason === "link_revoked" ? true : null,
          expired: resolved.reason === "expired" || resolved.reason === "link_expired" ? true : null,
          rateLimited: false,
        });
        return NextResponse.json(
          { success: false, message: contractPublicSessionMessage("acceptance") },
          { status: ["expired", "revoked", "link_expired", "link_revoked"].includes(resolved.reason) ? 410 : 401 },
        );
      }
      link = await resolveLinkById(resolved.session.linkId);
    } else {
      link = await resolveLink(token);
    }
    const problem = contractVoidLinkProblem(link);
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      return NextResponse.json({ success: false, message: problem }, { status: problem.includes("not found") ? 404 : 410 });
    }
    const ip = getRequestIp(req);
    if (!(await durableRateLimit(`contract-void:${link!.id}:${hashRequestValue(ip)}`, 10, 60 * 60 * 1000))) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: "rate_limited", revoked: false, expired: false, rateLimited: true });
      return NextResponse.json({ success: false, message: "Too many void attempts. Try again later." }, { status: 429 });
    }
    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const action = typeof body?.action === "string" ? body.action : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2_000) : "";
    const contract = link!.contract;
    const signer = link!.signer!;
    const ipHash = hashRequestValue(ip);

    if (action === "request") {
      if (link!.type !== "sign") throw new AgreementActionError("This link can only be used to confirm or decline a void request.", 409);
      if (contract.voidRequestedAt) throw new AgreementActionError("A void request is already pending.", 409);
      if (note.length < 5) throw new AgreementActionError("Add a short reason for the void request.", 400);
      let jobId = "";
      await prisma.$transaction(async (tx) => {
        const updated = await tx.contract.updateMany({ where: { id: contract.id, voidRequestedAt: null, status: "executed" }, data: { voidRequestedAt: new Date(), voidRequestedByRole: signer.role, voidRequestNote: note, voidConfirmNote: null } });
        if (updated.count !== 1) throw new AgreementActionError("A void request is already pending or the Agreement changed.", 409);
        await tx.contractEvent.create({ data: { contractId: contract.id, eventType: "void_requested", metadata: { byRole: signer.role, note }, ipHash } });
        jobId = await queueOwnerVoidRequest(tx, { contractId: contract.id, contractTitle: contract.title, ownerName: contract.user.name || contract.user.email, ownerEmail: contract.user.email, requesterName: signer.name, note });
      });
      await createNotification({ userId: contract.userId, type: "contract_void_requested", title: "Void requested", message: `${signer.name} requested to void ${contract.title}. Confirm or decline it on the Agreement.`, href: `/workflow/contracts/${contract.id}` }).catch(() => undefined);
      if (jobId && getEmailProvider() !== "disabled") await processEmailOutbox({ jobId }).catch((error) => console.error("Immediate owner void email attempt failed:", error));
      return NextResponse.json({ success: true, message: "Void requested. The sender must confirm before the Agreement is voided." });
    }

    if (action === "confirm") {
      if (!contract.voidRequestedAt || !contract.voidRequestedByRole || contract.voidRequestedByRole === signer.role) {
        throw new AgreementActionError("There is no void request from the other party to confirm.", 409);
      }
      if (note.length < 5) throw new AgreementActionError("Add a short confirmation note.", 400);
      const requesterRole = contract.voidRequestedByRole;
      await prisma.$transaction((tx) => completeAgreementVoid(tx, { contractId: contract.id, userId: contract.userId, projectId: contract.projectId, requesterRole, confirmedByRole: signer.role, note, ipHash }));
      await createNotification({ userId: contract.userId, type: "contract_voided", title: "Agreement voided", message: `${signer.name} confirmed the void of ${contract.title}.`, href: `/workflow/contracts/${contract.id}` }).catch(() => undefined);
      return NextResponse.json({ success: true, message: "Agreement voided. Its history is retained." });
    }

    if (action === "decline") {
      if (!contract.voidRequestedAt) throw new AgreementActionError("There is no void request to decline.", 409);
      const requesterRole = contract.voidRequestedByRole;
      await prisma.$transaction((tx) => clearAgreementVoidRequest(tx, { contractId: contract.id, declinedByRole: signer.role, requesterRole, note, ipHash }));
      if (requesterRole !== signer.role) {
        await createNotification({ userId: contract.userId, type: "contract_void_declined", title: "Void request declined", message: `${signer.name} declined to void ${contract.title}. It remains accepted.`, href: `/workflow/contracts/${contract.id}` }).catch(() => undefined);
      }
      return NextResponse.json({ success: true, message: requesterRole === signer.role ? "Void request withdrawn. The Agreement remains accepted." : "Void request declined. The Agreement remains accepted." });
    }

    throw new AgreementActionError("Unknown void action.", 400);
  } catch (error) {
    return agreementErrorResponse(error, "Unable to process the void request.", "Public contract void error");
  }
}
