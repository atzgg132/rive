import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { assertContractsEnabled, classifyContractPublicLinkFailure, getRequestId, hashAccessToken, logContractPublicLinkAccess } from "@/utils/contracts";
import { renderContractPdf } from "@/utils/contractPdf";
import type { ContractContent } from "@/utils/contracts";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;
    const link = await prisma.contractReviewLink.findUnique({ where: { tokenHash: hashAccessToken(token) }, include: { contract: true, version: true, signer: true } });
    const problem = !link
      ? "Accepted Agreement link not found or expired."
      : link.type !== "sign"
        ? "Accepted Agreement link not found or expired."
        : link.revokedAt
          ? "Artifact link has been revoked."
          : link.expiresAt <= new Date()
            ? "Artifact link has expired."
            : !link.version || !link.signer
              ? "Artifact link is incomplete."
              : null;
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "artifact", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      return NextResponse.json({ success: false, message: problem }, { status: 404 });
    }
    if (link!.contract.status !== "executed") {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "artifact", contractId: link!.contractId, versionId: link!.versionId, outcome: "not_ready", revoked: false, expired: false, rateLimited: false });
      return NextResponse.json({ success: false, message: "The acceptance record is not complete yet." }, { status: 409 });
    }
    const artifact = await prisma.contractArtifact.findFirst({ where: { contractId: link!.contractId, versionId: link!.version!.id, artifactType: "signed_pdf" }, orderBy: { generatedAt: "desc" } });
    if (!artifact) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "artifact", contractId: link!.contractId, versionId: link!.versionId, outcome: "artifact_unavailable", revoked: false, expired: false, rateLimited: false });
      return NextResponse.json({ success: false, message: "Accepted Agreement record is not available yet." }, { status: 404 });
    }
    const signatures = await prisma.contractSignature.findMany({ where: { contractId: link!.contractId, versionId: link!.version!.id }, orderBy: { signedAt: "asc" }, select: { id: true, signerRole: true, signerName: true, signerEmail: true, consentTextVersion: true, providerEventId: true, ipHash: true, userAgentHash: true, signedAt: true } });
    const pdf = await renderContractPdf({
      content: link!.version!.content as unknown as ContractContent,
      governingLaw: link!.contract.governingLaw,
      jurisdiction: link!.contract.jurisdiction,
      status: link!.contract.status,
      executedAt: link!.contract.executedAt?.toISOString() || null,
      documentHash: link!.version!.contentHash,
      evidenceHash: artifact.contentHash,
      provider: link!.contract.provider,
      signatures: signatures.map((signature) => ({ id: signature.id, role: signature.signerRole, name: signature.signerName, email: signature.signerEmail, consentTextVersion: signature.consentTextVersion, providerEventId: signature.providerEventId, ipHash: signature.ipHash, userAgentHash: signature.userAgentHash, signedAt: signature.signedAt.toISOString() })),
    });
    const filename = `${link!.contract.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "contract"}-executed.pdf`;
    logContractPublicLinkAccess({ request: req, requestId, purpose: "artifact", contractId: link!.contractId, versionId: link!.versionId, outcome: "allowed", revoked: false, expired: false, rateLimited: false });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Contract-Document-Hash": link!.version!.contentHash,
        "X-Contract-Evidence-Hash": artifact.contentHash,
      },
    });
  } catch (error) {
    console.error("Public Agreement artifact error:", error);
    return NextResponse.json({ success: false, message: "Unable to generate the accepted Agreement record." }, { status: 500 });
  }
}
