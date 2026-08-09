import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { assertContractsEnabled } from "@/utils/contracts";
import { renderContractPdf } from "@/utils/contractPdf";
import type { ContractContent } from "@/utils/contracts";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const contract = await prisma.contract.findFirst({ where: { id, userId: session.userId }, include: { versions: { orderBy: { version: "desc" }, take: 1 }, artifacts: { orderBy: { generatedAt: "desc" }, take: 1 } } });
    if (!contract) return NextResponse.json({ success: false, message: "Agreement not found." }, { status: 404 });
    if (contract.status !== "executed") return NextResponse.json({ success: false, message: "Only accepted Agreements have an available acceptance record." }, { status: 409 });
    const version = contract.versions[0];
    const artifact = contract.artifacts[0];
    if (!version || !artifact) return NextResponse.json({ success: false, message: "Accepted Agreement record is not available yet." }, { status: 404 });
    const signatures = await prisma.contractSignature.findMany({ where: { contractId: id, versionId: version.id }, orderBy: { signedAt: "asc" }, select: { id: true, signerRole: true, signerName: true, signerEmail: true, consentTextVersion: true, providerEventId: true, ipHash: true, userAgentHash: true, signedAt: true } });
    const pdf = await renderContractPdf({ content: version.content as unknown as ContractContent, governingLaw: contract.governingLaw, jurisdiction: contract.jurisdiction, status: contract.status, executedAt: contract.executedAt?.toISOString() || null, documentHash: version.contentHash, evidenceHash: artifact.contentHash, provider: contract.provider, signatures: signatures.map((signature) => ({ id: signature.id, role: signature.signerRole, name: signature.signerName, email: signature.signerEmail, consentTextVersion: signature.consentTextVersion, providerEventId: signature.providerEventId, ipHash: signature.ipHash, userAgentHash: signature.userAgentHash, signedAt: signature.signedAt.toISOString() })) });
    const filename = `${contract.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "agreement"}-accepted.pdf`;
    return new NextResponse(new Uint8Array(pdf), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store", "X-Contract-Document-Hash": version.contentHash, "X-Contract-Evidence-Hash": artifact.contentHash } });
  } catch (error) {
    console.error("Owner contract artifact error:", error);
    return NextResponse.json({ success: false, message: "Unable to generate the accepted Agreement record." }, { status: 500 });
  }
}
