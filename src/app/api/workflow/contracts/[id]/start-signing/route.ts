import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { sendContractSigningEmail } from "@/utils/email";
import { assertContractsEnabled, createAccessToken, CONTRACT_TOKEN_TTL_DAYS, hashAccessToken, isLocalEsignDemo, transitionContractStatus } from "@/utils/contracts";
import { getEsignProvider } from "@/utils/esign";

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    await transitionContractStatus(prisma, { where: { id, userId: session.userId, updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } }, from: "starting", to: "ready_to_sign" });

    const contract = await prisma.contract.findFirst({
      where: { id, userId: session.userId },
      include: {
        client: { select: { name: true, email: true } },
        user: { select: { name: true, email: true } },
        versions: { orderBy: { version: "desc" }, take: 1 },
        signers: { orderBy: { sequence: "asc" } },
      },
    });
    if (!contract) return NextResponse.json({ success: false, message: "Agreement not found." }, { status: 404 });
    if (contract.status === "signing" && contract.providerEnvelopeId) return NextResponse.json({ success: false, message: "Recorded acceptance has already started for this version." }, { status: 409 });
    if (contract.status !== "ready_to_sign") return NextResponse.json({ success: false, message: "Finalize the Agreement before starting recorded acceptance." }, { status: 409 });
    if (!contract.client.email) return NextResponse.json({ success: false, message: "The client needs an email address before recorded acceptance can start." }, { status: 400 });
    const version = contract.versions[0];
    if (!version) return NextResponse.json({ success: false, message: "Finalized Agreement version not found." }, { status: 409 });
    const clientSigner = contract.signers.find((signer) => signer.role === "client");
    const ownerSigner = contract.signers.find((signer) => signer.role === "owner");
    const ownerName = contract.user.name || contract.user.email;
    if (contract.signers.length !== 2 || !clientSigner || !ownerSigner || clientSigner.name.trim() !== contract.client.name.trim() || clientSigner.email.trim().toLowerCase() !== contract.client.email.trim().toLowerCase()) {
      return NextResponse.json({ success: false, message: "The client details changed after this Agreement version was created. Edit and save a new version before starting recorded acceptance." }, { status: 409 });
    }
    if (ownerSigner.name.trim() !== ownerName.trim() || ownerSigner.email.trim().toLowerCase() !== contract.user.email.trim().toLowerCase()) {
      return NextResponse.json({ success: false, message: "The owner details changed after this Agreement version was created. Edit and save a new version before starting recorded acceptance." }, { status: 409 });
    }

    const claimed = await transitionContractStatus(prisma, { where: { id, userId: session.userId }, from: "ready_to_sign", to: "starting" });
    if (claimed !== 1) return NextResponse.json({ success: false, message: "Recorded acceptance is already being started for this Agreement." }, { status: 409 });

    let provider: ReturnType<typeof getEsignProvider>;
    let envelope: Awaited<ReturnType<ReturnType<typeof getEsignProvider>["createEnvelope"]>>;
    try {
      provider = getEsignProvider();
      envelope = await provider.createEnvelope({
      contractId: contract.id,
      versionId: version.id,
      documentHash: version.contentHash,
      callbackUrl: `${appUrl()}/api/public/contracts/sign/provider-callback`,
      signers: [
        { signerId: clientSigner.id, name: clientSigner.name, email: clientSigner.email, role: "client", sequence: clientSigner.sequence },
        { signerId: ownerSigner.id, name: ownerSigner.name, email: ownerSigner.email, role: "owner", sequence: ownerSigner.sequence },
      ],
      });
      if (envelope.provider !== provider.name || envelope.status !== "created" || !envelope.providerEnvelopeId.trim()) {
        throw new Error("The configured provider returned an incomplete recorded-acceptance request.");
      }
    } catch (error) {
      await transitionContractStatus(prisma, { where: { id, userId: session.userId }, from: "starting", to: "ready_to_sign" }).catch(() => undefined);
      throw error;
    }

    const expiresAt = new Date(Date.now() + CONTRACT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const clientToken = createAccessToken();
    const ownerToken = createAccessToken();
    try {
      await prisma.$transaction(async (tx) => {
        const started = await transitionContractStatus(tx, { where: { id, userId: session.userId }, from: "starting", to: "signing", data: { provider: envelope.provider, providerEnvelopeId: envelope.providerEnvelopeId, reviewExpiresAt: expiresAt } });
        if (started !== 1) throw new Error("Recorded acceptance was cancelled or changed while the provider was preparing the request.");
        await tx.contractReviewLink.createMany({
          data: [
            { contractId: id, versionId: version.id, signerId: clientSigner.id, tokenHash: hashAccessToken(clientToken), type: "sign", expiresAt },
            { contractId: id, versionId: version.id, signerId: ownerSigner.id, tokenHash: hashAccessToken(ownerToken), type: "sign", expiresAt },
          ],
        });
        await tx.contractSigner.updateMany({ where: { contractId: id }, data: { invitedAt: new Date(), status: "pending" } });
        await tx.contractEvent.create({ data: { contractId: id, versionId: version.id, actorUserId: session.userId, eventType: "signing_started", metadata: { provider: envelope.provider, providerEnvelopeId: envelope.providerEnvelopeId } } });
      });
    } catch (error) {
      await provider.voidEnvelope(envelope.providerEnvelopeId).catch((voidError) => console.error("Contract provider cleanup error:", voidError));
      await transitionContractStatus(prisma, { where: { id, userId: session.userId }, from: "starting", to: "ready_to_sign" }).catch(() => undefined);
      throw error;
    }

    const clientSignUrl = `${appUrl()}/sign/${encodeURIComponent(clientToken)}`;
    const ownerSignUrl = `${appUrl()}/sign/${encodeURIComponent(ownerToken)}`;
    const email = await sendContractSigningEmail({ to: clientSigner.email, signerName: clientSigner.name, contractTitle: contract.title, signUrl: clientSignUrl, expiresAt });

    return NextResponse.json({ success: true, status: "signing", demo: isLocalEsignDemo(), clientSignUrl, ownerSignUrl, email: { sent: email.sent, reason: email.reason }, message: isLocalEsignDemo() ? "Local recorded-acceptance request started. Use the client acceptance link first, then the owner link." : "Recorded acceptance request started." });
  } catch (error) {
    console.error("Contract start signing error:", error);
    const message = error instanceof Error ? error.message : "Unable to start recorded acceptance.";
    return NextResponse.json({ success: false, message }, { status: message.includes("production") || message.includes("provider") ? 503 : 500 });
  }
}
