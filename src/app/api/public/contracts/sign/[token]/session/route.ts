import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import {
  assertContractsEnabled,
  classifyContractPublicLinkFailure,
  getRequestId,
  getRequestIp,
  hashAccessToken,
  hashRequestValue,
  logContractPublicLinkAccess,
} from "@/utils/contracts";
import {
  contractAcceptanceLinkProblem,
  contractPublicRedirectUrl,
  createContractPublicSession,
  isContractPublicSessionSegment,
  setContractPublicSessionCookie,
} from "@/utils/contractPublicSession";
import { durableRateLimit } from "@/utils/durableRateLimit";

/**
 * Session exchange for acceptance links. The /sign/[token] page redirects here;
 * a valid bearer link is traded for a purpose-bound HttpOnly session cookie and
 * the browser lands on the clean /sign page — the raw token leaves the address
 * bar and is never logged, returned, or carried into the redirect target.
 */
async function resolveLink(token: string) {
  return prisma.contractReviewLink.findUnique({
    where: { tokenHash: hashAccessToken(token) },
    include: {
      contract: { select: { id: true, status: true } },
      version: { select: { id: true } },
      signer: { select: { id: true } },
    },
  });
}

function redirectToClean(req: NextRequest, path: "/sign" | "/review"): NextResponse {
  return NextResponse.redirect(contractPublicRedirectUrl(path, req.url), 303);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;
    // Already-exchanged or reserved segment: nothing to swap, just land clean.
    if (isContractPublicSessionSegment(token)) return redirectToClean(req, "/sign");
    const ip = getRequestIp(req);
    if (!(await durableRateLimit(`contract-session:acceptance:${hashRequestValue(ip)}`, 60, 60 * 60 * 1000)) || !(await durableRateLimit("contract-session:acceptance:global", 600, 60 * 60 * 1000))) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: null, versionId: null, outcome: "rate_limited", revoked: null, expired: null, rateLimited: true });
      return redirectToClean(req, "/sign");
    }
    const link = await resolveLink(token);
    const problem = contractAcceptanceLinkProblem(link);
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      // The clean page renders the closed/unavailable state itself once the
      // session lookup fails — a redirect keeps this a page, not a JSON dump.
      return redirectToClean(req, "/sign");
    }
    const session = await createContractPublicSession(prisma, { link: link!, purpose: "acceptance" });
    await prisma.contractReviewLink.update({ where: { id: link!.id }, data: { lastAccessedAt: new Date() } }).catch(() => undefined);
    logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: "session_exchanged", revoked: false, expired: false, rateLimited: false });
    const response = redirectToClean(req, "/sign");
    setContractPublicSessionCookie(req, response, { purpose: "acceptance", token: session.token, expiresAt: session.expiresAt });
    return response;
  } catch (error) {
    console.error("Acceptance session exchange error:", error);
    return redirectToClean(req, "/sign");
  }
}
