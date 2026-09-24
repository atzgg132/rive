import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { buildContractSigningEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { agreementErrorResponse, AgreementActionError, assertContractsEnabled, createAccessToken, CONTRACT_TOKEN_TTL_DAYS, hashAccessToken, isLocalEsignDemo, transitionContractStatus } from "@/utils/contracts";
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
      return NextResponse.json({
        success: false,
        message: `The client on this finalized version is snapshotted as “${clientSigner?.name || "missing"} <${clientSigner?.email || "missing"}>”, but the live client is now “${contract.client.name} <${contract.client.email || "missing email"}>”. Edit the draft and save a new version before starting recorded acceptance.`,
      }, { status: 409 });
    }
    if (ownerSigner.name.trim() !== ownerName.trim() || ownerSigner.email.trim().toLowerCase() !== contract.user.email.trim().toLowerCase()) {
      return NextResponse.json({
        success: false,
        message: `The owner on this finalized version is snapshotted as “${ownerSigner.name} <${ownerSigner.email}>”, but the live owner is now “${ownerName} <${contract.user.email}>”. Edit the draft and save a new version before starting recorded acceptance.`,
      }, { status: 409 });
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
        throw new AgreementActionError("The configured provider returned an incomplete recorded-acceptance request.", 502);
      }
    } catch (error) {
      await transitionContractStatus(prisma, { where: { id, userId: session.userId }, from: "starting", to: "ready_to_sign" }).catch(() => undefined);
      throw error;
    }

    const expiresAt = new Date(Date.now() + CONTRACT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    // Only the client gets a public acceptance link. The owner records their
    // acceptance inside the signed-in workspace after the client accepts.
    const clientToken = createAccessToken();
    const clientTokenHash = hashAccessToken(clientToken);
    const clientSignUrl = `${appUrl()}/sign/${encodeURIComponent(clientToken)}`;
    const signingEmail = {
      ...buildContractSigningEmail({ to: clientSigner.email, signerName: clientSigner.name, contractTitle: contract.title, signUrl: clientSignUrl, expiresAt }),
      deliveryGuard: { kind: "contract_signing" as const, signerId: clientSigner.id, tokenHash: clientTokenHash },
    };
    let outboxId = "";
    try {
      await prisma.$transaction(async (tx) => {
        const started = await transitionContractStatus(tx, { where: { id, userId: session.userId }, from: "starting", to: "signing", data: { provider: envelope.provider, providerEnvelopeId: envelope.providerEnvelopeId, reviewExpiresAt: expiresAt } });
        if (started !== 1) throw new AgreementActionError("Recorded acceptance was cancelled or changed while the provider was preparing the request.", 409);
        await tx.contractReviewLink.updateMany({
          where: { contractId: id, signerId: { in: [clientSigner.id, ownerSigner.id] }, type: "sign", revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.contractReviewLink.create({
          data: { contractId: id, versionId: version.id, signerId: clientSigner.id, tokenHash: clientTokenHash, type: "sign", expiresAt },
        });
        await tx.contractSigner.updateMany({ where: { contractId: id }, data: { invitedAt: new Date(), status: "pending" } });
        await tx.contractEvent.create({ data: { contractId: id, versionId: version.id, actorUserId: session.userId, eventType: "signing_started", metadata: { provider: envelope.provider, providerEnvelopeId: envelope.providerEnvelopeId } } });
        outboxId = await enqueueEmail(signingEmail, tx);
      });
    } catch (error) {
      await provider.voidEnvelope(envelope.providerEnvelopeId).catch((voidError) => console.error("Contract provider cleanup error:", voidError));
      await transitionContractStatus(prisma, { where: { id, userId: session.userId }, from: "starting", to: "ready_to_sign" }).catch(() => undefined);
      throw error;
    }

    let delivered = false;
    if (getEmailProvider() !== "disabled" && outboxId) {
      const outbox = await processEmailOutbox({ jobId: outboxId }).catch((deliveryError) => {
        console.error("Immediate Agreement signing email attempt failed:", deliveryError);
        return null;
      });
      delivered = Boolean(outbox && outbox.sent > 0);
    }

    return NextResponse.json({
      success: true,
      status: "signing",
      demo: isLocalEsignDemo(),
      clientSignUrl,
      email: { queued: true, sent: delivered },
      message: delivered
        ? "Acceptance requested. The client was emailed their acceptance link; you record yours here after they accept."
        : "Acceptance requested. Email delivery is pending — copy the client acceptance link below and send it to the client.",
    });
  } catch (error) {
    return agreementErrorResponse(error, "Unable to start recorded acceptance.", "Contract start signing error");
  }
}
