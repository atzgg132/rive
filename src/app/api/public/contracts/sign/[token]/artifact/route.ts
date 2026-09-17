import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import {
  assertContractsEnabled,
  classifyContractPublicLinkFailure,
  getRequestId,
  hashAccessToken,
  logContractPublicLinkAccess,
} from "@/utils/contracts";
import {
  contractPublicSessionLogOutcome,
  contractPublicSessionMessage,
  isContractPublicSessionSegment,
  readContractPublicSessionToken,
  resolveContractPublicSession,
} from "@/utils/contractPublicSession";
import {
  contractArtifactHasStoredBytes,
  ensureContractExecutedArtifact,
  readContractArtifactBytes,
  renderLegacyContractArtifactBytes,
} from "@/utils/contractArtifacts";

const LINK_INCLUDE = {
  contract: true,
  version: true,
  signer: true,
} satisfies Prisma.ContractReviewLinkInclude;

type SignArtifactLink = Prisma.ContractReviewLinkGetPayload<{ include: typeof LINK_INCLUDE }>;

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

function linkProblem(link: SignArtifactLink | null): string | null {
  if (!link || link.type !== "sign") return "Accepted Agreement link not found or expired.";
  if (link.revokedAt) return "Artifact link has been revoked.";
  if (link.expiresAt <= new Date()) return "Artifact link has expired.";
  if (!link.version || !link.signer) return "Artifact link is incomplete.";
  return null;
}

function logAccess(req: NextRequest, requestId: string, link: SignArtifactLink | null, outcome: string, extra?: { revoked?: boolean | null; expired?: boolean | null }) {
  logContractPublicLinkAccess({
    request: req,
    requestId,
    purpose: "artifact",
    contractId: link?.contractId || null,
    versionId: link?.versionId || null,
    outcome,
    revoked: extra?.revoked ?? Boolean(link?.revokedAt),
    expired: extra?.expired ?? Boolean(link && link.expiresAt <= new Date()),
    rateLimited: false,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;
    let link: SignArtifactLink | null;
    // The reserved "session" segment reads the acceptance-purpose session
    // cookie so the accepted-PDF download never needs the raw token back.
    if (isContractPublicSessionSegment(token)) {
      const resolved = await resolveContractPublicSession(prisma, {
        purpose: "acceptance",
        token: readContractPublicSessionToken(req, "acceptance"),
      });
      if (!resolved.ok) {
        logAccess(req, requestId, null, contractPublicSessionLogOutcome(resolved.reason), {
          revoked: resolved.reason === "revoked" || resolved.reason === "link_revoked" ? true : null,
          expired: resolved.reason === "expired" || resolved.reason === "link_expired" ? true : null,
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
    const problem = linkProblem(link);
    if (problem) {
      logAccess(req, requestId, link, classifyContractPublicLinkFailure(problem));
      return NextResponse.json({ success: false, message: problem }, { status: 404 });
    }
    if (link!.contract.status !== "executed") {
      logAccess(req, requestId, link, "not_ready", { revoked: false, expired: false });
      return NextResponse.json({ success: false, message: "The acceptance record is not complete yet." }, { status: 409 });
    }
    const artifact = await ensureContractExecutedArtifact(prisma, { contractId: link!.contractId, versionId: link!.version!.id }).catch((error) => {
      console.error("Executed Agreement artifact ensure failed:", error);
      return null;
    });
    if (!artifact) {
      logAccess(req, requestId, link, "artifact_unavailable", { revoked: false, expired: false });
      return NextResponse.json({ success: false, message: "Accepted Agreement record is not available yet." }, { status: 404 });
    }
    // Stored bytes are authoritative. Only legacy "inline" rows that predate
    // byte storage re-render deterministically; everything else serves or 404s.
    let pdf = await readContractArtifactBytes(artifact).catch((error) => {
      console.error("Executed Agreement artifact read failed:", error);
      return null;
    });
    if (!pdf && artifact.storage === "inline" && !contractArtifactHasStoredBytes(artifact)) {
      pdf = await renderLegacyContractArtifactBytes(prisma, {
        contract: link!.contract,
        version: link!.version!,
        artifact,
      }).catch((error) => {
        console.error("Legacy Agreement artifact render failed:", error);
        return null;
      });
    }
    if (!pdf) {
      logAccess(req, requestId, link, "artifact_unavailable", { revoked: false, expired: false });
      return NextResponse.json({ success: false, message: "Accepted Agreement record is not available yet." }, { status: 404 });
    }
    const filename = `${link!.contract.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "contract"}-executed.pdf`;
    logAccess(req, requestId, link, "allowed", { revoked: false, expired: false });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "Vary": "Cookie",
        "X-Contract-Document-Hash": link!.version!.contentHash,
        "X-Contract-Evidence-Hash": artifact.contentHash,
      },
    });
  } catch (error) {
    console.error("Public Agreement artifact error:", error);
    return NextResponse.json({ success: false, message: "Unable to generate the accepted Agreement record." }, { status: 500 });
  }
}
