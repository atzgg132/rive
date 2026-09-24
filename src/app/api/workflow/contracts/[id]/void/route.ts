import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import {
  agreementErrorResponse,
  AgreementActionError,
  assertContractsEnabled,
  getRequestIp,
  hashRequestValue,
} from "@/utils/contracts";
import { getEmailProvider } from "@/utils/email";
import { processEmailOutbox } from "@/utils/emailOutbox";
import { clearAgreementVoidRequest, completeAgreementVoid, queueClientVoidRequest, voidBillingMessage } from "@/utils/agreementVoid";
import { readJsonBody } from "@/utils/apiBoundary";

// Two-party void for an EXECUTED Agreement. Either party may request; the OTHER
// party must confirm. The existing DELETE /contracts/[id] still voids
// non-executed Agreements unilaterally; this route is the only way to void an
// accepted one, and only with both parties' recorded consent.

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function deliverNow(jobId: string | null): Promise<boolean> {
  if (!jobId || getEmailProvider() === "disabled") return false;
  const result = await processEmailOutbox({ jobId }).catch((error) => {
    console.error("Immediate Agreement void email attempt failed:", error);
    return null;
  });
  return Boolean(result && result.sent > 0);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const ipHash = hashRequestValue(getRequestIp(req));
    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body as { action?: unknown; note?: unknown };
    const action = typeof body.action === "string" ? body.action : "";
    const note = clean(body.note, 2_000);

    const contract = await prisma.contract.findFirst({
      where: { id, userId: session.userId },
      include: {
        user: { select: { name: true, email: true } },
        signers: { select: { id: true, role: true, name: true, email: true } },
        versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
      },
    });
    if (!contract) throw new AgreementActionError("Agreement not found.", 404);
    if (contract.status !== "executed") {
      throw new AgreementActionError("Only an accepted Agreement can be voided through the two-party process.", 409);
    }
    const clientSigner = contract.signers.find((signer) => signer.role === "client");
    const requesterName = contract.user.name || contract.user.email;

    if (action === "request" || action === "resend") {
      if (action === "request") {
        if (contract.voidRequestedAt) throw new AgreementActionError("A void request is already pending for this Agreement.", 409);
        if (note.length < 5) throw new AgreementActionError("Add a short reason for the void request.", 400);
      } else if (!contract.voidRequestedAt || contract.voidRequestedByRole !== "owner") {
        throw new AgreementActionError("There is no pending void request of yours to resend.", 409);
      }
      if (!clientSigner?.email) throw new AgreementActionError("The client needs an email address before they can confirm a void.", 400);
      let jobId: string | null = null;
      await prisma.$transaction(async (tx) => {
        if (action === "request") {
          const updated = await tx.contract.updateMany({
            where: { id, userId: session.userId, voidRequestedAt: null, status: "executed" },
            data: { voidRequestedAt: new Date(), voidRequestedByRole: "owner", voidRequestNote: note, voidConfirmNote: null },
          });
          if (updated.count !== 1) throw new AgreementActionError("A void request is already pending or the Agreement changed.", 409);
          await tx.contractEvent.create({ data: { contractId: id, actorUserId: session.userId, eventType: "void_requested", metadata: { byRole: "owner", note }, ipHash } });
        } else {
          await tx.contractEvent.create({ data: { contractId: id, actorUserId: session.userId, eventType: "void_request_resent", metadata: { byRole: "owner" }, ipHash } });
        }
        jobId = await queueClientVoidRequest(tx, {
          contractId: id,
          versionId: contract.versions[0]?.id || null,
          clientSigner,
          contractTitle: contract.title,
          requesterName,
          note: action === "request" ? note : contract.voidRequestNote || "",
        });
      });
      const delivered = await deliverNow(jobId);
      return NextResponse.json({
        success: true,
        email: { queued: true, sent: delivered },
        message: delivered
          ? "Void requested. The client was emailed a link to confirm; the Agreement stays accepted until they do."
          : "Void requested. The confirmation email is queued — use Resend if the client does not receive it.",
      });
    }

    if (action === "confirm") {
      if (!contract.voidRequestedAt || contract.voidRequestedByRole !== "client") {
        throw new AgreementActionError("There is no void request from the client to confirm.", 409);
      }
      if (note.length < 5) throw new AgreementActionError("Add a short confirmation note.", 400);
      const billing = await prisma.$transaction((tx) => completeAgreementVoid(tx, {
        contractId: id,
        userId: session.userId,
        projectId: contract.projectId,
        requesterRole: "client",
        confirmedByRole: "owner",
        note,
        ipHash,
        actorUserId: session.userId,
      }));
      const billingNote = voidBillingMessage("This Agreement", billing);
      return NextResponse.json({ success: true, billing, message: billingNote || "Agreement voided. Its history is retained." });
    }

    if (action === "decline") {
      if (!contract.voidRequestedAt) throw new AgreementActionError("There is no void request to decline.", 409);
      await prisma.$transaction((tx) => clearAgreementVoidRequest(tx, {
        contractId: id,
        declinedByRole: "owner",
        requesterRole: contract.voidRequestedByRole,
        note,
        ipHash,
        actorUserId: session.userId,
      }));
      return NextResponse.json({
        success: true,
        message: contract.voidRequestedByRole === "owner" ? "Void request withdrawn. The Agreement remains accepted." : "Void request declined. The Agreement remains accepted.",
      });
    }

    throw new AgreementActionError("Unknown void action.", 400);
  } catch (error) {
    return agreementErrorResponse(error, "Unable to process the void request.", "Contract void error");
  }
}
