import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { agreementErrorResponse, AgreementActionError, assertContractsEnabled } from "@/utils/contracts";
import { declineAgreementAcceptance, finishAgreementAcceptance, recordAgreementAcceptance } from "@/utils/agreementAcceptance";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { readJsonBody } from "@/utils/apiBoundary";

/**
 * The owner's recorded acceptance, taken inside the signed-in workspace. The
 * owner never receives a public acceptance link: the session identifies them,
 * and the same typed-name + consent evidence is recorded as for the client.
 * `action: "decline"` stops the request so the owner can revise the draft.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const ip = getRequestIp(req);
    if (!rateLimit(`agreement-owner-accept:${session.userId}:${id}`, 10, 60 * 60 * 1000)) {
      throw new AgreementActionError("Too many acceptance attempts. Try again later.", 429);
    }
    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body as { action?: unknown; typedName?: unknown; consentAccepted?: unknown; reason?: unknown };

    const contract = await prisma.contract.findFirst({
      where: { id, userId: session.userId },
      select: {
        id: true,
        signers: { where: { role: "owner" }, take: 1, select: { id: true } },
        versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
      },
    });
    if (!contract) throw new AgreementActionError("Agreement not found.", 404);
    const ownerSigner = contract.signers[0];
    const version = contract.versions[0];
    if (!ownerSigner || !version) throw new AgreementActionError("The owner acceptance party or version is missing.", 409);

    if (body.action === "decline") {
      await declineAgreementAcceptance({
        contractId: contract.id,
        signerId: ownerSigner.id,
        reason: typeof body.reason === "string" ? body.reason : "",
        ip,
        channel: "workspace",
        actorUserId: session.userId,
      });
      return NextResponse.json({ success: true, declined: true, message: "Acceptance request stopped. Edit the draft and save a new version." });
    }

    const typedName = typeof body.typedName === "string" ? body.typedName : "";
    if (!typedName.trim()) throw new AgreementActionError("Type your full name to record acceptance.", 400);
    const outcome = await recordAgreementAcceptance({
      contractId: contract.id,
      signerId: ownerSigner.id,
      versionId: version.id,
      typedName,
      consentAccepted: body.consentAccepted === true,
      ip,
      userAgent: req.headers.get("user-agent") || "unknown",
      channel: "workspace",
      actorUserId: session.userId,
    });
    const { artifactHash } = await finishAgreementAcceptance(outcome);
    return NextResponse.json({
      success: true,
      completed: outcome.completed,
      alreadySigned: outcome.alreadySigned,
      artifactHash,
      message: outcome.completed
        ? "Your acceptance is recorded. The Agreement is accepted by both parties."
        : outcome.alreadySigned
          ? "Your acceptance was already recorded."
          : "Your acceptance is recorded.",
    });
  } catch (error) {
    return agreementErrorResponse(error, "Unable to record your acceptance.", "Owner Agreement acceptance error");
  }
}
