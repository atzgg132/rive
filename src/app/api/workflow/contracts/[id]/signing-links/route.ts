import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { buildContractSigningEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import {
  agreementErrorResponse,
  AgreementActionError,
  assertContractsEnabled,
  CONTRACT_TOKEN_TTL_DAYS,
  createAccessToken,
  hashAccessToken,
} from "@/utils/contracts";
import { getSessionUser } from "@/utils/userAuth";
import { readJsonBody } from "@/utils/apiBoundary";

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body as { role?: unknown; sendEmail?: unknown };
    // Only the client has a public acceptance link; the owner accepts in the
    // workspace (POST /api/workflow/contracts/[id]/accept).
    if (body.role === "owner") throw new AgreementActionError("You record your own acceptance on the Agreement page — there is no owner link.", 400, "owner_accepts_in_workspace");
    const role = "client" as const;

    const contract = await prisma.contract.findFirst({
      where: { id, userId: session.userId },
      include: {
        versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
        signers: { where: { role }, take: 1 },
      },
    });
    if (!contract) return NextResponse.json({ success: false, message: "Agreement not found." }, { status: 404 });
    if (contract.status !== "signing") return NextResponse.json({ success: false, message: "Acceptance links can only be reissued while acceptance is being collected." }, { status: 409 });
    const version = contract.versions[0];
    const signer = contract.signers[0];
    if (!version || !signer) return NextResponse.json({ success: false, message: "The acceptance party or version is missing." }, { status: 409 });
    if (signer.status === "signed") return NextResponse.json({ success: false, message: `${signer.name} has already recorded acceptance on this version.` }, { status: 409 });
    if (signer.status !== "pending") return NextResponse.json({ success: false, message: "This acceptance party is not awaiting recorded acceptance." }, { status: 409 });
    if (!signer.email) return NextResponse.json({ success: false, message: "The acceptance party needs an email address before a link can be issued." }, { status: 400 });

    const token = createAccessToken();
    const tokenHash = hashAccessToken(token);
    const expiresAt = new Date(Date.now() + CONTRACT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const signUrl = `${appUrl()}/sign/${encodeURIComponent(token)}`;
    const shouldEmail = body.sendEmail === true;
    let outboxId = "";
    await prisma.$transaction(async (tx) => {
      await tx.contractReviewLink.updateMany({
        where: { contractId: id, signerId: signer.id, type: "sign", revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.contractReviewLink.create({
        data: {
          contractId: id,
          versionId: version.id,
          signerId: signer.id,
          tokenHash,
          type: "sign",
          expiresAt,
        },
      });
      await tx.contractSigner.update({ where: { id: signer.id }, data: { invitedAt: new Date() } });
      const refreshedContract = await tx.contract.updateMany({
        where: { id, userId: session.userId, status: "signing" },
        data: { reviewExpiresAt: expiresAt },
      });
      if (refreshedContract.count !== 1) throw new AgreementActionError("This acceptance request changed before the new link was issued.", 409);
      await tx.contractEvent.create({
        data: {
          contractId: id,
          versionId: version.id,
          actorUserId: session.userId,
          eventType: "signing_link_reissued",
          metadata: { role, signerId: signer.id, emailed: shouldEmail, expiresAt: expiresAt.toISOString() },
        },
      });
      if (shouldEmail) {
        outboxId = await enqueueEmail({
          ...buildContractSigningEmail({ to: signer.email, signerName: signer.name, contractTitle: contract.title, signUrl, expiresAt }),
          deliveryGuard: { kind: "contract_signing", signerId: signer.id, tokenHash },
        }, tx);
      }
    });

    let delivered = false;
    if (shouldEmail && outboxId && getEmailProvider() !== "disabled") {
      const outbox = await processEmailOutbox({ jobId: outboxId }).catch((deliveryError) => {
        console.error("Immediate Agreement signing-link email attempt failed:", deliveryError);
        return null;
      });
      delivered = Boolean(outbox && outbox.sent > 0);
    }

    return NextResponse.json({
      success: true,
      role,
      signUrl,
      expiresAt,
      email: shouldEmail ? { queued: true, sent: delivered } : null,
      message: shouldEmail
        ? delivered
          ? "New client acceptance link emailed. The previous link no longer works."
          : "New client acceptance link created. Email delivery is pending — copy it below and send it to the client."
        : "New client acceptance link created. The previous link no longer works.",
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: false, message: "A signing link was already reissued. Refresh before trying again." }, { status: 409 });
    }
    return agreementErrorResponse(error, "Unable to reissue the acceptance link.", "Signing link reissue error");
  }
}
