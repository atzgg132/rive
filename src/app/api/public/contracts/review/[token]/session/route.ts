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
  contractReviewLinkProblem,
  createContractPublicSession,
  isContractPublicSessionSegment,
  setContractPublicSessionCookie,
} from "@/utils/contractPublicSession";
import { durableRateLimit } from "@/utils/durableRateLimit";

/**
 * Session exchange for review links. The /review/[token] page redirects here;
 * a valid bearer link is traded for a purpose-bound HttpOnly session cookie and
 * the browser lands on the clean /review page — the raw token leaves the
 * address bar and is never logged, returned, or carried into the redirect.
 */
async function resolveLink(token: string) {
  return prisma.contractReviewLink.findUnique({
    where: { tokenHash: hashAccessToken(token) },
    include: {
      contract: { select: { id: true, status: true } },
      version: { select: { id: true } },
    },
  });
}

function redirectToClean(req: NextRequest): NextResponse {
  const target = new URL("/review", req.url);
  // Preserve attribution params (utm_*/ref) across the exchange so analytics
  // keeps working without ever carrying the token itself forward.
  target.search = new URL(req.url).search;
  return NextResponse.redirect(target, 303);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;
    if (isContractPublicSessionSegment(token)) return redirectToClean(req);
    const ip = getRequestIp(req);
    if (!(await durableRateLimit(`contract-session:review:${hashRequestValue(ip)}`, 60, 60 * 60 * 1000)) || !(await durableRateLimit("contract-session:review:global", 600, 60 * 60 * 1000))) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "review", contractId: null, versionId: null, outcome: "rate_limited", revoked: null, expired: null, rateLimited: true });
      return redirectToClean(req);
    }
    const link = await resolveLink(token);
    const problem = contractReviewLinkProblem(link);
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "review", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      // The clean page renders the unavailable state itself once the session
      // lookup fails — a redirect keeps this a page, not a JSON dump.
      return redirectToClean(req);
    }
    const session = await createContractPublicSession(prisma, { link: link!, purpose: "review" });
    await prisma.contractReviewLink.update({ where: { id: link!.id }, data: { lastAccessedAt: new Date() } }).catch(() => undefined);
    logContractPublicLinkAccess({ request: req, requestId, purpose: "review", contractId: link!.contractId, versionId: link!.versionId, outcome: "session_exchanged", revoked: false, expired: false, rateLimited: false });
    const response = redirectToClean(req);
    setContractPublicSessionCookie(req, response, { purpose: "review", token: session.token, expiresAt: session.expiresAt });
    return response;
  } catch (error) {
    console.error("Review session exchange error:", error);
    return redirectToClean(req);
  }
}
