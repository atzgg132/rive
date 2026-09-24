import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import {
  agreementErrorResponse,
  AgreementActionError,
  assertContractsEnabled,
  createAccessToken,
  hashAccessToken,
} from "@/utils/contracts";
import { acceptedRecordExpiry } from "@/utils/agreementAcceptance";
import { buildContractExecutedEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { rateLimit } from "@/utils/rateLimit";

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Email the client a fresh link to the accepted Agreement. The original link
 * expires; the record should not become unreachable for the client because
 * of that, so the owner can always send a new copy.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    if (!rateLimit(`agreement-accepted-copy:${session.userId}:${id}`, 5, 60 * 60 * 1000)) {
      throw new AgreementActionError("Too many copies sent. Try again later.", 429);
    }
    const contract = await prisma.contract.findFirst({
      where: { id, userId: session.userId },
      select: {
        id: true,
        title: true,
        status: true,
        client: { select: { name: true, email: true } },
        versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
      },
    });
    if (!contract) throw new AgreementActionError("Agreement not found.", 404);
    if (contract.status !== "executed") throw new AgreementActionError("Only an accepted Agreement has a copy to send.", 409);
    if (!contract.client.email) throw new AgreementActionError("Add the client’s email before sending the accepted copy.", 400);
    const version = contract.versions[0];
    if (!version) throw new AgreementActionError("Accepted Agreement version not found.", 409);

    const token = createAccessToken();
    const artifactUrl = `${appUrl()}/api/public/contracts/artifact/${encodeURIComponent(token)}`;
    const jobId = await prisma.$transaction(async (tx) => {
      await tx.contractReviewLink.create({ data: { contractId: contract.id, versionId: version.id, tokenHash: hashAccessToken(token), type: "artifact", expiresAt: acceptedRecordExpiry(new Date()) } });
      await tx.contractEvent.create({ data: { contractId: contract.id, versionId: version.id, actorUserId: session.userId, eventType: "accepted_copy_sent", metadata: { to: "client" } } });
      return enqueueEmail(buildContractExecutedEmail({ to: contract.client.email!, recipientName: contract.client.name, contractTitle: contract.title, artifactUrl }), tx);
    });
    let delivered = false;
    if (getEmailProvider() !== "disabled") {
      const result = await processEmailOutbox({ jobId }).catch((error) => {
        console.error("Accepted copy email attempt failed:", error);
        return null;
      });
      delivered = Boolean(result && result.sent > 0);
    }
    return NextResponse.json({
      success: true,
      email: { queued: true, sent: delivered },
      message: delivered ? `Accepted copy emailed to ${contract.client.email}.` : "Accepted copy queued. It will be emailed when delivery is available.",
    });
  } catch (error) {
    return agreementErrorResponse(error, "Unable to send the accepted copy.", "Accepted copy send error");
  }
}
