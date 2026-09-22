import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  contractArtifactLinkProblem,
  contractPublicRedirectUrl,
  contractPublicSessionLogOutcome,
  contractPublicSessionMessage,
  createContractPublicSession,
  isContractPublicSessionSegment,
  readContractPublicSessionToken,
  resolveContractPublicSession,
  setContractPublicSessionCookie,
} from "@/utils/contractPublicSession";
import {
  contractArtifactHasStoredBytes,
  ensureContractExecutedArtifact,
  readContractArtifactBytes,
  renderLegacyContractArtifactBytes,
  type ContractArtifactRow,
} from "@/utils/contractArtifacts";
import { durableRateLimit } from "@/utils/durableRateLimit";

const LINK_INCLUDE = {
  contract: true,
  version: true,
} satisfies Prisma.ContractReviewLinkInclude;

type ArtifactLink = Prisma.ContractReviewLinkGetPayload<{ include: typeof LINK_INCLUDE }>;

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

function logAccess(req: NextRequest, requestId: string, link: ArtifactLink | null, outcome: string, extra?: { revoked?: boolean | null; expired?: boolean | null; rateLimited?: boolean }) {
  logContractPublicLinkAccess({
    request: req,
    requestId,
    purpose: "artifact",
    contractId: link?.contractId || null,
    versionId: link?.versionId || null,
    outcome,
    revoked: extra?.revoked ?? Boolean(link?.revokedAt),
    expired: extra?.expired ?? Boolean(link && link.expiresAt <= new Date()),
    rateLimited: extra?.rateLimited ?? false,
  });
}

/**
 * Stream the recorded bytes. Accepted artifacts are served exactly as stored —
 * the only regeneration permitted is the deterministic re-render for legacy
 * "inline" rows written before byte storage existed (there are no stored bytes
 * to serve and the append-only row cannot be repaired in place).
 */
async function storedArtifactPdf(
  link: ArtifactLink,
  artifact: ContractArtifactRow,
): Promise<Uint8Array | null> {
  const stored = await readContractArtifactBytes(artifact);
  if (stored) return stored;
  if (artifact.storage === "inline" && !contractArtifactHasStoredBytes(artifact)) {
    return renderLegacyContractArtifactBytes(prisma, {
      contract: link.contract,
      version: link.version!,
      artifact,
    });
  }
  return null;
}

async function artifactPdfResponse(req: NextRequest, requestId: string, link: ArtifactLink) {
  const artifact = await ensureContractExecutedArtifact(prisma, { contractId: link.contractId, versionId: link.version!.id }).catch((error) => {
    console.error("Executed Agreement artifact ensure failed:", error);
    return null;
  });
  if (!artifact) {
    logAccess(req, requestId, link, "artifact_unavailable");
    return NextResponse.json({ success: false, message: "Accepted Agreement record is not available." }, { status: 404 });
  }
  const pdf = await storedArtifactPdf(link, artifact).catch((error) => {
    console.error("Executed Agreement artifact read failed:", error);
    return null;
  });
  if (!pdf) {
    logAccess(req, requestId, link, "artifact_unavailable");
    return NextResponse.json({ success: false, message: "Accepted Agreement record is not available." }, { status: 404 });
  }
  const filename = `${link.contract.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "contract"}-executed.pdf`;
  await prisma.contractReviewLink.update({ where: { id: link.id }, data: { lastAccessedAt: new Date() } }).catch(() => undefined);
  logAccess(req, requestId, link, "allowed", { revoked: false, expired: false });
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "Vary": "Cookie",
      "X-Contract-Document-Hash": link.version!.contentHash,
      "X-Contract-Evidence-Hash": artifact.contentHash,
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;

    // Cookie-backed path: /api/public/contracts/artifact/session
    if (isContractPublicSessionSegment(token)) {
      const ip = getRequestIp(req);
      const sessionToken = readContractPublicSessionToken(req, "artifact");
      const tokenKey = hashRequestValue(sessionToken || "missing");
      if (!(await durableRateLimit(`contract-artifact-get:${tokenKey}:${hashRequestValue(ip)}`, 60, 60 * 60 * 1000)) || !(await durableRateLimit("contract-artifact-get:global", 600, 60 * 60 * 1000))) {
        logAccess(req, requestId, null, "rate_limited", { revoked: null, expired: null, rateLimited: true });
        return NextResponse.json({ success: false, message: "Too many download attempts. Try again later." }, { status: 429 });
      }
      const resolved = await resolveContractPublicSession(prisma, {
        purpose: "artifact",
        token: sessionToken,
      });
      if (!resolved.ok) {
        logAccess(req, requestId, null, contractPublicSessionLogOutcome(resolved.reason), {
          revoked: resolved.reason === "revoked" || resolved.reason === "link_revoked" ? true : null,
          expired: resolved.reason === "expired" || resolved.reason === "link_expired" ? true : null,
        });
        return NextResponse.json(
          { success: false, message: contractPublicSessionMessage("artifact") },
          { status: ["expired", "revoked", "link_expired", "link_revoked"].includes(resolved.reason) ? 410 : 401 },
        );
      }
      const link = await resolveLinkById(resolved.session.linkId);
      const problem = contractArtifactLinkProblem(link);
      if (problem) {
        logAccess(req, requestId, link, classifyContractPublicLinkFailure(problem));
        return NextResponse.json({ success: false, message: problem }, { status: 404 });
      }
      return artifactPdfResponse(req, requestId, link!);
    }

    // Bearer compatibility path: validate, exchange the raw token for a
    // purpose-bound HttpOnly session cookie, then strip the token from the
    // address bar via redirect. The token is never logged or returned.
    const ip = getRequestIp(req);
    if (!(await durableRateLimit(`contract-session:artifact:${hashRequestValue(ip)}`, 60, 60 * 60 * 1000)) || !(await durableRateLimit("contract-session:artifact:global", 600, 60 * 60 * 1000))) {
      logAccess(req, requestId, null, "rate_limited", { revoked: null, expired: null, rateLimited: true });
      return NextResponse.json({ success: false, message: "Too many download attempts. Try again later." }, { status: 429 });
    }
    const link = await resolveLink(token);
    const problem = contractArtifactLinkProblem(link);
    if (problem) {
      logAccess(req, requestId, link, classifyContractPublicLinkFailure(problem));
      return NextResponse.json({ success: false, message: problem }, { status: 404 });
    }
    const session = await createContractPublicSession(prisma, { link: link!, purpose: "artifact" });
    logAccess(req, requestId, link, "session_exchanged", { revoked: false, expired: false });
    const response = NextResponse.redirect(contractPublicRedirectUrl("/api/public/contracts/artifact/session", req.url), 303);
    setContractPublicSessionCookie(req, response, { purpose: "artifact", token: session.token, expiresAt: session.expiresAt });
    return response;
  } catch (error) {
    console.error("Public completed Agreement artifact error:", error);
    return NextResponse.json({ success: false, message: "Unable to generate the accepted Agreement record." }, { status: 500 });
  }
}
