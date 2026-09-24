import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import {
  agreementErrorResponse,
  AgreementActionError,
  assertContractsEnabled,
  classifyContractPublicLinkFailure,
  CONTRACT_CONSENT_TEXT,
  CONTRACT_CONSENT_TEXT_VERSION,
  getRequestId,
  getRequestIp,
  hashAccessToken,
  hashRequestValue,
  isLocalEsignDemo,
  logContractPublicLinkAccess,
} from "@/utils/contracts";
import {
  contractAcceptanceLinkProblem,
  contractPublicSessionLogOutcome,
  contractPublicSessionMessage,
  isContractPublicSessionSegment,
  readContractPublicSessionToken,
  resolveContractPublicSession,
} from "@/utils/contractPublicSession";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { declineAgreementAcceptance, finishAgreementAcceptance, recordAgreementAcceptance } from "@/utils/agreementAcceptance";
import { getSessionUser } from "@/utils/userAuth";
import { readJsonBody } from "@/utils/apiBoundary";

const LINK_INCLUDE = {
  contract: { include: { client: { select: { name: true, email: true } }, user: { select: { email: true } } } },
  version: true,
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

/**
 * Bearer token or public-session lookup. The reserved "session" segment reads
 * the purpose-bound HttpOnly cookie; anything else keeps the legacy
 * bearer-token compatibility path. Session rows only ever carry the token
 * hash, and a session is rejected when its parent link has since been revoked
 * or expired.
 */
async function resolveRequestLink(req: NextRequest, token: string): Promise<
  | { link: Awaited<ReturnType<typeof resolveLink>>; session: null }
  | { link: null; session: { reason: string; contractId: string | null; versionId: string | null } }
> {
  if (!isContractPublicSessionSegment(token)) return { link: await resolveLink(token), session: null };
  const resolved = await resolveContractPublicSession(prisma, {
    purpose: "acceptance",
    token: readContractPublicSessionToken(req, "acceptance"),
  });
  if (!resolved.ok) {
    return {
      link: null,
      session: { reason: resolved.reason, contractId: resolved.session?.contractId || null, versionId: resolved.session?.versionId || null },
    };
  }
  return { link: await resolveLinkById(resolved.session.linkId), session: null };
}

function sessionFailureResponse(req: NextRequest, requestId: string, failure: { reason: string; contractId: string | null; versionId: string | null }) {
  logContractPublicLinkAccess({
    request: req,
    requestId,
    purpose: "acceptance",
    contractId: failure.contractId,
    versionId: failure.versionId,
    outcome: contractPublicSessionLogOutcome(failure.reason as Parameters<typeof contractPublicSessionLogOutcome>[0]),
    revoked: failure.reason === "revoked" || failure.reason === "link_revoked" ? true : null,
    expired: failure.reason === "expired" || failure.reason === "link_expired" ? true : null,
    rateLimited: false,
  });
  return NextResponse.json(
    { success: false, message: contractPublicSessionMessage("acceptance") },
    { status: ["expired", "revoked", "link_expired", "link_revoked"].includes(failure.reason) ? 410 : 401 },
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;
    const ip = getRequestIp(req);
    const tokenKey = isContractPublicSessionSegment(token)
      ? hashRequestValue(readContractPublicSessionToken(req, "acceptance") || "missing")
      : hashAccessToken(token);
    if (!(await durableRateLimit(`contract-sign-get:${tokenKey}:${hashRequestValue(ip)}`, 60, 60 * 60 * 1000)) || !(await durableRateLimit("contract-sign-get:global", 600, 60 * 60 * 1000))) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: null, versionId: null, outcome: "rate_limited", revoked: null, expired: null, rateLimited: true });
      return NextResponse.json({ success: false, message: "Too many requests. Try again later." }, { status: 429 });
    }
    const resolved = await resolveRequestLink(req, token);
    if (resolved.session) return sessionFailureResponse(req, requestId, resolved.session);
    const link = resolved.link;
    const problem = contractAcceptanceLinkProblem(link);
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      return NextResponse.json({ success: false, message: problem }, { status: problem.includes("not found") ? 404 : 410 });
    }
    await prisma.contractReviewLink.update({ where: { id: link!.id }, data: { lastAccessedAt: new Date() } });
    logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: "allowed", revoked: false, expired: false, rateLimited: false });
    const priorUnfinished = await prisma.contractSigner.count({ where: { contractId: link!.contractId, sequence: { lt: link!.signer!.sequence }, status: { not: "signed" } } });
    const content = link!.version!.content as Record<string, unknown>;
    const contentGoverningLaw = typeof content.governingLaw === "string" ? content.governingLaw : link!.contract.governingLaw;
    const contentJurisdiction = typeof content.jurisdiction === "string" || content.jurisdiction === null ? content.jurisdiction : link!.contract.jurisdiction;
    const completed = link!.contract.status === "executed";
    // The owner previewing the client's link must not be able to accept in the
    // client's name; the page shows a warning instead of the form.
    const viewer = await getSessionUser(req).catch(() => null);
    const viewerIsOwner = Boolean(viewer && viewer.userId === link!.contract.userId);
    return NextResponse.json({
      success: true,
      mode: completed ? "completed" : priorUnfinished > 0 ? "waiting" : link!.signer!.status === "signed" ? "signed" : "sign",
      demo: isLocalEsignDemo(),
      contract: {
        id: link!.contract.id,
        title: link!.contract.title,
        status: link!.contract.status,
        governing_law: contentGoverningLaw,
        jurisdiction: contentJurisdiction,
        currency: link!.contract.currency,
        client_name: link!.contract.client.name,
        content,
        version: { id: link!.version!.id, number: link!.version!.version, hash: link!.version!.contentHash },
        expires_at: link!.expiresAt,
        executed_at: link!.contract.executedAt,
        void_requested_at: link!.contract.voidRequestedAt,
        void_requested_by_role: link!.contract.voidRequestedByRole,
        void_request_note: link!.contract.voidRequestNote,
        void_confirm_note: link!.contract.voidConfirmNote,
      },
      signer: { id: link!.signer!.id, role: link!.signer!.role, name: link!.signer!.name, email: link!.signer!.email, status: link!.signer!.status, sequence: link!.signer!.sequence },
      consent: { version: CONTRACT_CONSENT_TEXT_VERSION, text: CONTRACT_CONSENT_TEXT },
      downloadUrl: completed ? `/api/public/contracts/sign/${encodeURIComponent(token)}/artifact` : null,
      viewer_is_owner: viewerIsOwner,
    }, { headers: { "Cache-Control": "no-store", "Vary": "Cookie" } });
  } catch (error) {
    return agreementErrorResponse(error, "Unable to load this acceptance link.", "Public contract sign fetch error");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;
    const resolved = await resolveRequestLink(req, token);
    if (resolved.session) return sessionFailureResponse(req, requestId, resolved.session);
    const link = resolved.link;
    const problem = contractAcceptanceLinkProblem(link);
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      return NextResponse.json({ success: false, message: problem }, { status: problem.includes("not found") ? 404 : 410 });
    }
    if (link!.type !== "sign") {
      return NextResponse.json({ success: false, message: "This is a void-confirmation link. Use the void controls on the page." }, { status: 409 });
    }
    const ip = getRequestIp(req);
    if (!(await durableRateLimit(`contract-sign:${link!.id}:${hashRequestValue(ip)}`, 5, 60 * 60 * 1000))) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: "rate_limited", revoked: false, expired: false, rateLimited: true });
      return NextResponse.json({ success: false, message: "Too many acceptance attempts. Try again later." }, { status: 429 });
    }
    const viewer = await getSessionUser(req).catch(() => null);
    if (viewer && viewer.userId === link!.contract.userId) {
      throw new AgreementActionError("You are signed in as the owner of this Agreement. The client must record acceptance from their own link.", 403, "owner_on_client_link");
    }
    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;

    if (body?.action === "decline") {
      await declineAgreementAcceptance({
        contractId: link!.contractId,
        signerId: link!.signer!.id,
        reason: typeof body.reason === "string" ? body.reason : "",
        ip,
        channel: "public_link",
      });
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: "declined", revoked: false, expired: false, rateLimited: false });
      return NextResponse.json({ success: true, declined: true, message: "The recorded-acceptance request was declined and the sender has been notified." });
    }

    const typedName = typeof body?.typedName === "string" ? body.typedName : "";
    if (!typedName.trim()) throw new AgreementActionError("Type your full name to record acceptance.", 400);
    const outcome = await recordAgreementAcceptance({
      contractId: link!.contractId,
      signerId: link!.signer!.id,
      versionId: link!.version!.id,
      typedName,
      consentAccepted: body?.consentAccepted === true,
      ip,
      userAgent: req.headers.get("user-agent") || "unknown",
      channel: "public_link",
    });
    const { artifactHash } = await finishAgreementAcceptance(outcome);
    logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: outcome.completed ? "accepted" : outcome.alreadySigned ? "already_accepted" : "acceptance_recorded", revoked: false, expired: false, rateLimited: false });
    return NextResponse.json({
      success: true,
      alreadySigned: outcome.alreadySigned,
      completed: outcome.completed,
      artifactHash,
      downloadUrl: outcome.completed ? `/api/public/contracts/sign/${encodeURIComponent(token)}/artifact` : null,
      message: outcome.completed
        ? "Both parties have recorded acceptance. The accepted Agreement is ready."
        : outcome.alreadySigned
          ? "This party has already recorded acceptance."
          : "Your acceptance is recorded. The sender has been asked to record theirs.",
    });
  } catch (error) {
    return agreementErrorResponse(error, "Unable to record acceptance.", "Public contract sign error");
  }
}
