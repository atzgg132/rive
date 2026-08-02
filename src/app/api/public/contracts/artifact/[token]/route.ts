import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { assertContractsEnabled, hashAccessToken } from "@/utils/contracts";
import { renderContractPdf } from "@/utils/contractPdf";
import type { ContractContent } from "@/utils/contracts";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    assertContractsEnabled();
    const { token } = await params;
    const link = await prisma.contractReviewLink.findUnique({ where: { tokenHash: hashAccessToken(token) }, include: { contract: true, version: true } });
    if (!link || link.type !== "artifact" || link.revokedAt || link.expiresAt <= new Date() || !link.version || link.contract.status !== "executed") return NextResponse.json({ success: false, message: "Completed artifact link not found or expired." }, { status: 404 });
    const artifact = await prisma.contractArtifact.findFirst({ where: { contractId: link.contractId, versionId: link.version.id, artifactType: "signed_pdf" }, orderBy: { generatedAt: "desc" } });
    if (!artifact) return NextResponse.json({ success: false, message: "Completed artifact is not available." }, { status: 404 });
    const signatures = await prisma.contractSignature.findMany({ where: { contractId: link.contractId, versionId: link.version.id }, orderBy: { signedAt: "asc" }, select: { id: true, signerRole: true, signerName: true, signerEmail: true, consentTextVersion: true, providerEventId: true, ipHash: true, userAgentHash: true, signedAt: true } });
    const pdf = await renderContractPdf({ content: link.version.content as unknown as ContractContent, governingLaw: link.contract.governingLaw, jurisdiction: link.contract.jurisdiction, status: link.contract.status, executedAt: link.contract.executedAt?.toISOString() || null, documentHash: link.version.contentHash, evidenceHash: artifact.contentHash, provider: link.contract.provider, signatures: signatures.map((signature) => ({ id: signature.id, role: signature.signerRole, name: signature.signerName, email: signature.signerEmail, consentTextVersion: signature.consentTextVersion, providerEventId: signature.providerEventId, ipHash: signature.ipHash, userAgentHash: signature.userAgentHash, signedAt: signature.signedAt.toISOString() })) });
    const filename = `${link.contract.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "contract"}-executed.pdf`;
    await prisma.contractReviewLink.update({ where: { id: link.id }, data: { lastAccessedAt: new Date() } });
    return new NextResponse(new Uint8Array(pdf), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store", "X-Contract-Document-Hash": link.version.contentHash, "X-Contract-Evidence-Hash": artifact.contentHash } });
  } catch (error) {
    console.error("Public completed contract artifact error:", error);
    return NextResponse.json({ success: false, message: "Unable to generate the completed contract artifact." }, { status: 500 });
  }
}
