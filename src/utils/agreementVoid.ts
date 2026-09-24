import "server-only";

import { Prisma } from "@prisma/client";
import {
  AgreementActionError,
  CONTRACT_TOKEN_TTL_DAYS,
  createAccessToken,
  hashAccessToken,
  resetProjectCoverageIfNoActiveContracts,
  transitionContractStatus,
} from "@/utils/contracts";
import { buildContractVoidRequestedEmail } from "@/utils/email";
import { enqueueEmail } from "@/utils/emailOutbox";

/**
 * Two-party void of an accepted Agreement, shared by the owner's workspace
 * route and the client's public record page. The client confirms through a
 * purpose-bound void link; the owner always confirms in the workspace.
 */

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Revoke the client's previous void link, mint a new one, and queue the email
 * in the same transaction. The outbox guard drops the email if the link is
 * revoked before delivery (for example, the request was withdrawn).
 */
export async function queueClientVoidRequest(
  tx: Prisma.TransactionClient,
  input: {
    contractId: string;
    versionId: string | null;
    clientSigner: { id: string; name: string; email: string };
    contractTitle: string;
    requesterName: string;
    note: string;
  },
): Promise<string> {
  const token = createAccessToken();
  const tokenHash = hashAccessToken(token);
  await tx.contractReviewLink.updateMany({ where: { contractId: input.contractId, signerId: input.clientSigner.id, type: "void", revokedAt: null }, data: { revokedAt: new Date() } });
  const link = await tx.contractReviewLink.create({
    data: {
      contractId: input.contractId,
      versionId: input.versionId,
      signerId: input.clientSigner.id,
      tokenHash,
      type: "void",
      expiresAt: new Date(Date.now() + CONTRACT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return enqueueEmail({
    ...buildContractVoidRequestedEmail({
      to: input.clientSigner.email,
      recipientName: input.clientSigner.name,
      contractTitle: input.contractTitle,
      requesterName: input.requesterName,
      note: input.note,
      actionUrl: `${appUrl()}/sign/${encodeURIComponent(token)}`,
      recipientIsOwner: false,
    }),
    deliveryGuard: { kind: "contract_void", linkId: link.id, tokenHash },
  }, tx);
}

/** Queue the owner's copy of a client-raised void request (workspace link). */
export async function queueOwnerVoidRequest(
  tx: Prisma.TransactionClient,
  input: { contractId: string; contractTitle: string; ownerName: string; ownerEmail: string; requesterName: string; note: string },
): Promise<string> {
  return enqueueEmail(buildContractVoidRequestedEmail({
    to: input.ownerEmail,
    recipientName: input.ownerName,
    contractTitle: input.contractTitle,
    requesterName: input.requesterName,
    note: input.note,
    actionUrl: `${appUrl()}/workflow/contracts/${encodeURIComponent(input.contractId)}`,
    recipientIsOwner: true,
  }), tx);
}

/**
 * Move an accepted Agreement to void once the other party confirmed. Revokes
 * every public link and records the two-party evidence.
 */
export async function completeAgreementVoid(
  tx: Prisma.TransactionClient,
  input: {
    contractId: string;
    userId: string;
    projectId: string | null;
    requesterRole: string;
    confirmedByRole: string;
    note: string;
    ipHash: string;
    actorUserId?: string | null;
  },
): Promise<void> {
  const voided = await transitionContractStatus(tx, {
    where: { id: input.contractId, status: "executed", voidRequestedAt: { not: null }, voidRequestedByRole: input.requesterRole },
    from: "executed",
    to: "void",
    data: { voidedAt: new Date(), voidConfirmNote: input.note },
  });
  if (voided !== 1) throw new AgreementActionError("The Agreement changed before the void was confirmed. Reload and try again.", 409);
  await tx.contractReviewLink.updateMany({ where: { contractId: input.contractId, revokedAt: null }, data: { revokedAt: new Date() } });
  await tx.contractEvent.create({ data: { contractId: input.contractId, actorUserId: input.actorUserId || undefined, eventType: "void_confirmed", metadata: { confirmedByRole: input.confirmedByRole, requesterRole: input.requesterRole, note: input.note }, ipHash: input.ipHash } });
  await tx.contractEvent.create({ data: { contractId: input.contractId, eventType: "contract_voided", metadata: { via: "two_party", confirmedByRole: input.confirmedByRole, requesterRole: input.requesterRole } } });
  if (input.projectId) await resetProjectCoverageIfNoActiveContracts(tx, input.projectId, input.userId);
}

/** Clear a pending void request (declined by the other party or withdrawn). */
export async function clearAgreementVoidRequest(
  tx: Prisma.TransactionClient,
  input: { contractId: string; declinedByRole: string; requesterRole: string | null; note: string; ipHash: string; actorUserId?: string | null },
): Promise<void> {
  const cleared = await tx.contract.updateMany({
    where: { id: input.contractId, voidRequestedAt: { not: null }, status: "executed" },
    data: { voidRequestedAt: null, voidRequestedByRole: null, voidRequestNote: null, voidConfirmNote: null },
  });
  if (cleared.count !== 1) throw new AgreementActionError("The void request was already resolved.", 409);
  await tx.contractReviewLink.updateMany({ where: { contractId: input.contractId, type: "void", revokedAt: null }, data: { revokedAt: new Date() } });
  const withdrawn = input.declinedByRole === input.requesterRole;
  await tx.contractEvent.create({
    data: {
      contractId: input.contractId,
      actorUserId: input.actorUserId || undefined,
      eventType: withdrawn ? "void_request_withdrawn" : "void_request_declined",
      metadata: { declinedByRole: input.declinedByRole, requesterRole: input.requesterRole, note: input.note },
      ipHash: input.ipHash,
    },
  });
}
