import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { AgreementActionError } from "@/utils/agreementErrors";
import {
  CONTRACT_CONSENT_TEXT_VERSION,
  createAccessToken,
  createNotification,
  getConfiguredEsignProvider,
  hashAccessToken,
  hashRequestValue,
  transitionContractStatus,
} from "@/utils/contracts";
import { buildContractExecutedEmail, buildOwnerAcceptanceDueEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { ensureContractExecutedArtifact } from "@/utils/contractArtifacts";
import { ensureAcceptedAgreementWorkSetup } from "@/utils/projectGeneration";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

/**
 * Recorded acceptance for both parties.
 *
 * The client accepts through their public acceptance link; the owner accepts
 * inside their signed-in workspace. Both paths record the same evidence
 * (typed name, consent version, hashed request metadata) through this one
 * writer, so the rules — client first, exact current version, typed name must
 * match the snapshotted party — cannot drift between them.
 */

/** How long an accepted Agreement stays reachable from the client's link. */
export const ACCEPTED_RECORD_ACCESS_DAYS = 365;

export type AcceptanceChannel = "public_link" | "workspace";

export type AcceptanceOutcome = {
  contractId: string;
  versionId: string;
  signerRole: string;
  alreadySigned: boolean;
  completed: boolean;
  /** Set only by the request that completed the Agreement. */
  artifactToken: string | null;
  mailJobIds: string[];
};

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function typedNameMatches(typedName: string, partyName: string): boolean {
  return typedName.trim().toLocaleLowerCase() === partyName.trim().toLocaleLowerCase();
}

export function acceptedRecordExpiry(executedAt: Date): Date {
  return new Date(executedAt.getTime() + ACCEPTED_RECORD_ACCESS_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Whether a contract in `status` may take this signer's acceptance. An expired
 * request is reopened only for the owner, only in the workspace, and only on
 * the finalized version — i.e. the client already accepted and the request
 * lapsed while waiting on the owner. Everything else must be `signing`.
 */
export function acceptanceStatusDecision(input: {
  status: string;
  channel: AcceptanceChannel;
  signerRole: string;
  versionStatus: string | null;
}): "accept" | "reopen" | "closed" {
  if (input.status === "signing") return "accept";
  if (
    input.status === "expired"
    && input.channel === "workspace"
    && input.signerRole === "owner"
    && input.versionStatus === "final"
  ) {
    return "reopen";
  }
  return "closed";
}

export async function recordAgreementAcceptance(input: {
  contractId: string;
  signerId: string;
  versionId: string;
  typedName: string;
  consentAccepted: boolean;
  ip: string;
  userAgent: string;
  channel: AcceptanceChannel;
  actorUserId?: string | null;
}): Promise<AcceptanceOutcome> {
  const typedName = input.typedName.trim().slice(0, 180);
  const provider = getConfiguredEsignProvider();
  const artifactToken = createAccessToken();
  const ipHash = hashRequestValue(input.ip);

  try {
    return await prisma.$transaction(async (tx) => {
      const signer = await tx.contractSigner.findUnique({ where: { id: input.signerId } });
      if (!signer || signer.contractId !== input.contractId) throw new AgreementActionError("Acceptance party not found.", 404);
      const contract = await tx.contract.findUnique({
        where: { id: input.contractId },
        include: {
          client: { select: { name: true, email: true } },
          user: { select: { name: true, email: true } },
          versions: { orderBy: { version: "desc" }, take: 1, select: { id: true, status: true } },
        },
      });
      if (!contract) throw new AgreementActionError("Agreement not found.", 404);
      const base = { contractId: contract.id, versionId: input.versionId, signerRole: signer.role };

      if (signer.status === "signed") {
        return { ...base, alreadySigned: true, completed: contract.status === "executed", artifactToken: null, mailJobIds: [] };
      }
      if (signer.status !== "pending") throw new AgreementActionError("This acceptance party is not awaiting recorded acceptance.", 409);
      const latest = contract.versions[0];
      if (!latest || latest.id !== input.versionId) {
        throw new AgreementActionError("A newer version of this Agreement exists. Ask the sender for the current acceptance link.", 409);
      }
      const priorPending = await tx.contractSigner.count({ where: { contractId: contract.id, sequence: { lt: signer.sequence }, status: { not: "signed" } } });
      if (priorPending > 0) {
        throw new AgreementActionError(
          signer.role === "owner" ? "The client must record acceptance before you can." : "The other party must record acceptance first.",
          409,
          "client_first",
        );
      }

      const decision = acceptanceStatusDecision({ status: contract.status, channel: input.channel, signerRole: signer.role, versionStatus: latest.status });
      if (decision === "closed") throw new AgreementActionError("This Agreement is not currently accepting recorded acceptance.", 409);
      if (!typedNameMatches(typedName, signer.name)) {
        throw new AgreementActionError(
          `The typed name must match the named party exactly (ignore capitalization): “${signer.name}”. Ask the sender to edit the Agreement and save a new version if that party name is wrong.`,
          400,
          "typed_name_mismatch",
        );
      }
      if (input.consentAccepted !== true) throw new AgreementActionError("You must confirm the recorded-acceptance consent before continuing.", 400);

      if (decision === "reopen") {
        const reopened = await transitionContractStatus(tx, { where: { id: contract.id }, from: "expired", to: "signing", data: { reviewExpiresAt: null } });
        if (reopened !== 1) throw new AgreementActionError("This Agreement changed while your acceptance was being recorded. Reload and try again.", 409);
        await tx.contractEvent.create({ data: { contractId: contract.id, versionId: latest.id, actorUserId: input.actorUserId || undefined, eventType: "acceptance_request_reopened", metadata: { reason: "owner_accepted_after_expiry" } } });
      }

      const signedAt = new Date();
      await tx.contractSignature.create({
        data: {
          contractId: contract.id,
          versionId: latest.id,
          signerId: signer.id,
          signerRole: signer.role,
          signerName: signer.name,
          signerEmail: signer.email,
          signatureType: "typed",
          signatureValue: typedName,
          consentAccepted: true,
          consentTextVersion: CONTRACT_CONSENT_TEXT_VERSION,
          ipHash,
          userAgentHash: hashRequestValue(input.userAgent || "unknown"),
          providerEventId: `${provider}_signature_${signedAt.getTime()}_${signer.id}`,
          providerPayload: {
            provider,
            demo: provider === "local",
            channel: input.channel,
            ...(input.channel === "workspace" ? { authenticatedUserId: input.actorUserId || null } : { tokenWasPresented: true }),
          } as Prisma.InputJsonValue,
          signedAt,
        },
      });
      await tx.contractSigner.update({ where: { id: signer.id }, data: { status: "signed", signedAt } });
      await tx.contractEvent.create({
        data: {
          contractId: contract.id,
          versionId: latest.id,
          actorUserId: input.actorUserId || undefined,
          eventType: "signer_signed",
          metadata: { signerId: signer.id, role: signer.role, channel: input.channel, consentTextVersion: CONTRACT_CONSENT_TEXT_VERSION },
          ipHash,
        },
      });

      const remaining = await tx.contractSigner.count({ where: { contractId: contract.id, status: { not: "signed" } } });
      if (remaining > 0) return { ...base, alreadySigned: false, completed: false, artifactToken: null, mailJobIds: [] };

      const executedAt = new Date();
      const executed = await transitionContractStatus(tx, { where: { id: contract.id }, from: "signing", to: "executed", data: { executedAt, reviewExpiresAt: null } });
      if (executed !== 1) throw new AgreementActionError("This Agreement was changed or voided before final acceptance was recorded.", 409);
      await tx.contractEvent.create({ data: { contractId: contract.id, versionId: latest.id, eventType: "contract_executed", metadata: { executedAt: executedAt.toISOString(), signedBy: "client_and_owner" } } });

      // The accepted record must stay reachable after the 14-day request
      // window: the client's acceptance link becomes their record link
      // (download + void requests), and the emailed copy lasts as long.
      const recordExpiresAt = acceptedRecordExpiry(executedAt);
      await tx.contractReviewLink.updateMany({ where: { contractId: contract.id, type: "sign", revokedAt: null }, data: { expiresAt: recordExpiresAt } });
      // The signed_pdf artifact row is written after commit by
      // ensureContractExecutedArtifact so the recorded hash is the hash of the
      // actual stored bytes — evidence can never point at a render that failed.
      await tx.contractReviewLink.create({ data: { contractId: contract.id, versionId: latest.id, tokenHash: hashAccessToken(artifactToken), type: "artifact", expiresAt: recordExpiresAt } });
      const artifactUrl = `${appUrl()}/api/public/contracts/artifact/${encodeURIComponent(artifactToken)}`;
      const mailJobIds: string[] = [];
      if (contract.client.email) {
        mailJobIds.push(await enqueueEmail(buildContractExecutedEmail({ to: contract.client.email, recipientName: contract.client.name, contractTitle: contract.title, artifactUrl }), tx));
      }
      mailJobIds.push(await enqueueEmail(buildContractExecutedEmail({ to: contract.user.email, recipientName: contract.user.name || contract.user.email, contractTitle: contract.title, artifactUrl }), tx));
      return { ...base, alreadySigned: false, completed: true, artifactToken, mailJobIds };
    });
  } catch (error) {
    // A double submit races on the one-signature-per-signer index; report the
    // already-recorded acceptance instead of an error.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const [signer, contract] = await Promise.all([
      prisma.contractSigner.findUnique({ where: { id: input.signerId }, select: { contractId: true, status: true, role: true } }),
      prisma.contract.findUnique({ where: { id: input.contractId }, select: { status: true } }),
    ]);
    if (signer?.contractId !== input.contractId || signer.status !== "signed" || !contract || !["signing", "executed"].includes(contract.status)) throw error;
    return { contractId: input.contractId, versionId: input.versionId, signerRole: signer.role, alreadySigned: true, completed: contract.status === "executed", artifactToken: null, mailJobIds: [] };
  }
}

/**
 * Post-commit follow-up. Nothing here can undo a recorded acceptance: every
 * step is idempotent and failures are logged, not thrown.
 */
export async function finishAgreementAcceptance(outcome: AcceptanceOutcome): Promise<{ artifactHash: string | null }> {
  let artifactHash: string | null = null;
  if (outcome.completed) {
    const artifact = await ensureContractExecutedArtifact(prisma, { contractId: outcome.contractId, versionId: outcome.versionId }).catch((error) => {
      console.error("Executed Agreement artifact render/store failed:", error);
      return null;
    });
    artifactHash = artifact?.contentHash || null;
  }

  const contract = await prisma.contract.findUnique({
    where: { id: outcome.contractId },
    select: { id: true, userId: true, title: true, client: { select: { name: true } }, user: { select: { name: true, email: true } } },
  });
  if (!contract) return { artifactHash };

  if (outcome.completed) {
    await ensureAcceptedAgreementWorkSetup(prisma, { userId: contract.userId, contractId: contract.id, acceptedVersionId: outcome.versionId }).catch((error) => {
      console.error("Post-acceptance work-setup backfill failed:", error);
    });
  }

  if (outcome.completed && outcome.artifactToken) {
    await recordActivationEvent(contract.userId, ACTIVATION_EVENTS.firstMeaningfulWorkflowCompleted, { contractId: contract.id, workflow: "contract_executed" }).catch(() => undefined);
    await recordProductEvent({ userId: contract.userId, eventName: PRODUCT_EVENTS.agreementAccepted, module: "agreements", entityType: "contract", entityId: contract.id, source: outcome.signerRole === "owner" ? "workspace_acceptance" : "public_acceptance", dedupeKey: `agreement_accepted:${contract.id}` }).catch(() => undefined);
    await createNotification({ userId: contract.userId, type: "contract_work_setup", title: "Agreement accepted — set up the work", message: `${contract.title} has both parties’ acceptance recorded. Set up the work when you’re ready.`, href: `/workflow/contracts/${contract.id}` }).catch(() => undefined);
  }

  if (!outcome.completed && !outcome.alreadySigned && outcome.signerRole === "client") {
    await notifyOwnerAcceptanceDue({ contractId: contract.id, userId: contract.userId, title: contract.title, clientName: contract.client.name, ownerName: contract.user.name || contract.user.email, ownerEmail: contract.user.email });
  }

  if (getEmailProvider() !== "disabled") {
    for (const jobId of outcome.mailJobIds) {
      await processEmailOutbox({ jobId }).catch((error) => console.error("Immediate Agreement acceptance mail attempt failed:", error));
    }
  }
  return { artifactHash };
}

/** In-app notification plus email: the client accepted, the owner is next. */
export async function notifyOwnerAcceptanceDue(input: {
  contractId: string;
  userId: string;
  title: string;
  clientName: string;
  ownerName: string;
  ownerEmail: string;
  reminder?: boolean;
}): Promise<void> {
  const href = `/workflow/contracts/${input.contractId}`;
  await createNotification({
    userId: input.userId,
    type: "contract_acceptance_due",
    title: input.reminder ? "Reminder: your acceptance is still needed" : "Your acceptance is next",
    message: `${input.clientName} accepted ${input.title}. Record your acceptance to complete the Agreement.`,
    href,
  }).catch(() => undefined);
  try {
    const jobId = await enqueueEmail(buildOwnerAcceptanceDueEmail({ to: input.ownerEmail, ownerName: input.ownerName, clientName: input.clientName, contractTitle: input.title, agreementUrl: `${appUrl()}${href}` }));
    if (getEmailProvider() !== "disabled") await processEmailOutbox({ jobId }).catch((error) => console.error("Owner acceptance-due email attempt failed:", error));
  } catch (error) {
    console.error("Owner acceptance-due email enqueue failed:", error);
  }
}

/**
 * A party asks for changes instead of accepting. Stops the request, revokes
 * the acceptance links, and keeps any partial acceptance attached to this
 * version as evidence. The owner is notified when the client declines.
 */
export async function declineAgreementAcceptance(input: {
  contractId: string;
  signerId: string;
  reason: string;
  ip: string;
  channel: AcceptanceChannel;
  actorUserId?: string | null;
}): Promise<void> {
  const reason = input.reason.trim().slice(0, 2_000);
  if (reason.length < 5) throw new AgreementActionError("Briefly explain what needs to change.", 400);
  const declinedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const signer = await tx.contractSigner.findUnique({ where: { id: input.signerId } });
    if (!signer || signer.contractId !== input.contractId) throw new AgreementActionError("Acceptance party not found.", 404);
    if (signer.status === "signed") throw new AgreementActionError("A recorded acceptance cannot be replaced by a change request.", 409);
    if (signer.status === "declined") return null;
    if (signer.status !== "pending") throw new AgreementActionError("This acceptance party cannot decline the current request.", 409);
    const contract = await tx.contract.findUnique({ where: { id: input.contractId }, select: { id: true, userId: true, title: true, status: true, versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } } } });
    if (!contract) throw new AgreementActionError("Agreement not found.", 404);
    if (!["signing", "expired"].includes(contract.status)) throw new AgreementActionError("This Agreement is not currently collecting acceptance.", 409);
    const declined = await transitionContractStatus(tx, { where: { id: contract.id }, from: contract.status, to: contract.status === "signing" ? "declined" : "draft", data: { reviewExpiresAt: null } });
    if (declined !== 1) throw new AgreementActionError("This acceptance request changed before the decline was recorded.", 409);
    await tx.contractSigner.update({ where: { id: signer.id }, data: { status: "declined", declinedAt } });
    await tx.contractReviewLink.updateMany({ where: { contractId: contract.id, type: "sign", revokedAt: null }, data: { revokedAt: declinedAt } });
    await tx.contractEvent.create({ data: { contractId: contract.id, versionId: contract.versions[0]?.id, actorUserId: input.actorUserId || undefined, eventType: "signer_declined", metadata: { signerId: signer.id, role: signer.role, channel: input.channel, reason }, ipHash: hashRequestValue(input.ip) } });
    return { contract, signer };
  });
  if (result && result.signer.role === "client") {
    await createNotification({ userId: result.contract.userId, type: "contract_declined", title: "Acceptance changes requested", message: `${result.signer.name} requested changes to ${result.contract.title}: ${reason.slice(0, 180)}`, href: `/workflow/contracts/${result.contract.id}` }).catch(() => undefined);
  }
}
