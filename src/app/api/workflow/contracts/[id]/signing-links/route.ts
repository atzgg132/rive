import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { sendContractSigningEmail } from "@/utils/email";
import {
  assertContractsEnabled,
  CONTRACT_TOKEN_TTL_DAYS,
  createAccessToken,
  hashAccessToken,
} from "@/utils/contracts";
import { getSessionUser } from "@/utils/userAuth";

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
    const body = await request.json().catch(() => null) as { role?: unknown; sendEmail?: unknown } | null;
    const role = body?.role === "client" ? "client" : body?.role === "owner" ? "owner" : "";
    if (!role) return NextResponse.json({ success: false, message: "Choose the client or owner acceptance link." }, { status: 400 });

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
    const expiresAt = new Date(Date.now() + CONTRACT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
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
          tokenHash: hashAccessToken(token),
          type: "sign",
          expiresAt,
        },
      });
      await tx.contractSigner.update({ where: { id: signer.id }, data: { invitedAt: new Date() } });
      const refreshedContract = await tx.contract.updateMany({
        where: { id, userId: session.userId, status: "signing" },
        data: { reviewExpiresAt: expiresAt },
      });
      if (refreshedContract.count !== 1) throw new Error("This acceptance request changed before the new link was issued.");
      await tx.contractEvent.create({
        data: {
          contractId: id,
          versionId: version.id,
          actorUserId: session.userId,
          eventType: "signing_link_reissued",
          metadata: { role, signerId: signer.id, emailed: body?.sendEmail === true, expiresAt: expiresAt.toISOString() },
        },
      });
    });

    const signUrl = `${appUrl()}/sign/${encodeURIComponent(token)}`;
    const email = body?.sendEmail === true
      ? await sendContractSigningEmail({ to: signer.email, signerName: signer.name, contractTitle: contract.title, signUrl, expiresAt })
      : null;

    return NextResponse.json({
      success: true,
      role,
      signUrl,
      expiresAt,
      email: email ? { sent: email.sent, reason: email.reason } : null,
      message: email
        ? email.sent
          ? `${role === "client" ? "Client" : "Owner"} acceptance link reissued and emailed.`
          : `Acceptance link reissued, but email delivery failed${email.reason ? `: ${email.reason}` : "."}`
        : `${role === "client" ? "Client" : "Owner"} acceptance link reissued.`,
    });
  } catch (error) {
    console.error("Signing link reissue error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unable to reissue the acceptance link." }, { status: 500 });
  }
}
