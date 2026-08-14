import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { sendContractExecutedEmail } from "@/utils/email";
import {
  assertContractsEnabled,
  classifyContractPublicLinkFailure,
  CONTRACT_CONSENT_TEXT,
  CONTRACT_CONSENT_TEXT_VERSION,
  createAccessToken,
  getConfiguredEsignProvider,
  getRequestId,
  getRequestIp,
  hashAccessToken,
  hashRequestValue,
  isLocalEsignDemo,
  logContractPublicLinkAccess,
  sha256,
  stableStringify,
  transitionContractStatus,
} from "@/utils/contracts";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { createNotification } from "@/utils/contracts";
import { processContractBilling } from "@/utils/contractBilling";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";

async function resolveLink(token: string) {
  return prisma.contractReviewLink.findUnique({
    where: { tokenHash: hashAccessToken(token) },
    include: {
      contract: { include: { client: { select: { name: true, email: true } } } },
      version: true,
      signer: true,
    },
  });
}

function invalidLink(link: Awaited<ReturnType<typeof resolveLink>>): string | null {
  if (!link || link.type !== "sign") return "Acceptance link not found.";
  if (link.revokedAt) return "This acceptance link has been revoked.";
  if (link.expiresAt <= new Date()) return "This acceptance link has expired. Ask the sender to reissue it.";
  if (!link.version || !link.signer) return "This acceptance link is incomplete.";
  if (!["signing", "executed"].includes(link.contract.status)) return "This Agreement is not currently accepting recorded acceptance.";
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;
    const link = await resolveLink(token);
    const problem = invalidLink(link);
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      return NextResponse.json({ success: false, message: problem }, { status: problem.includes("not found") ? 404 : 410 });
    }
    await prisma.contractReviewLink.update({ where: { id: link!.id }, data: { lastAccessedAt: new Date() } });
    logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: "allowed", revoked: false, expired: false, rateLimited: false });
    const priorUnfinished = await prisma.contractSigner.count({ where: { contractId: link!.contractId, sequence: { lt: link!.signer!.sequence }, status: { not: "signed" } } });
    const content = link!.version!.content as Record<string, unknown>;
    const contentGoverningLaw = typeof content.governingLaw === "string" ? content.governingLaw : link!.contract.governingLaw;
    const contentJurisdiction = typeof content.jurisdiction === "string" || content.jurisdiction === null ? content.jurisdiction : link!.contract.jurisdiction;
    const completed = link!.contract.status === "executed";
    return NextResponse.json({
      success: true,
      mode: completed ? "completed" : priorUnfinished > 0 ? "waiting" : link!.signer!.status === "signed" ? "signed" : "sign",
      demo: isLocalEsignDemo(),
      contract: {
        id: link!.contract.id,
        title: link!.contract.title,
        status: link!.contract.status,
        governing_law: contentGoverningLaw,
        jurisdiction: contentJurisdiction,
        currency: link!.contract.currency,
        client_name: link!.contract.client.name,
        content,
        version: { id: link!.version!.id, number: link!.version!.version, hash: link!.version!.contentHash },
        expires_at: link!.expiresAt,
        executed_at: link!.contract.executedAt,
        void_requested_at: link!.contract.voidRequestedAt,
        void_requested_by_role: link!.contract.voidRequestedByRole,
        void_request_note: link!.contract.voidRequestNote,
        void_confirm_note: link!.contract.voidConfirmNote,
      },
      signer: { id: link!.signer!.id, role: link!.signer!.role, name: link!.signer!.name, email: link!.signer!.email, status: link!.signer!.status, sequence: link!.signer!.sequence },
      consent: { version: CONTRACT_CONSENT_TEXT_VERSION, text: CONTRACT_CONSENT_TEXT },
      downloadUrl: completed ? `/api/public/contracts/sign/${encodeURIComponent(token)}/artifact` : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Public contract sign fetch error:", error);
    return NextResponse.json({ success: false, message: "Unable to load this acceptance link." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const provider = getConfiguredEsignProvider();
    const { token } = await params;
    const link = await resolveLink(token);
    const problem = invalidLink(link);
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      return NextResponse.json({ success: false, message: problem }, { status: problem.includes("not found") ? 404 : 410 });
    }
    const ip = getRequestIp(req);
    if (!(await durableRateLimit(`contract-sign:${link!.id}:${hashRequestValue(ip)}`, 5, 60 * 60 * 1000))) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: "rate_limited", revoked: false, expired: false, rateLimited: true });
      return NextResponse.json({ success: false, message: "Too many acceptance attempts. Try again later." }, { status: 429 });
    }
    const body = await req.json().catch(() => null) as { action?: unknown; typedName?: unknown; consentAccepted?: unknown; reason?: unknown } | null;
    if (body?.action === "decline") {
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 2_000) : "";
      if (reason.length < 5) return NextResponse.json({ success: false, message: "Briefly explain what needs to change before recording acceptance." }, { status: 400 });
      const declinedAt = new Date();
      await prisma.$transaction(async (tx) => {
        const signer = await tx.contractSigner.findUnique({ where: { id: link!.signer!.id } });
        if (!signer || signer.contractId !== link!.contractId) throw new Error("Acceptance party not found.");
        if (signer.status === "signed") throw new Error("A recorded acceptance cannot be replaced by a change request.");
        if (signer.status === "declined") return;
        if (signer.status !== "pending") throw new Error("This acceptance party cannot decline the current request.");
        const declined = await transitionContractStatus(tx, { where: { id: link!.contractId }, from: "signing", to: "declined", data: { reviewExpiresAt: null } });
        if (declined !== 1) throw new Error("This acceptance request changed before the decline was recorded.");
        await tx.contractSigner.update({ where: { id: signer.id }, data: { status: "declined", declinedAt } });
        await tx.contractReviewLink.updateMany({ where: { contractId: link!.contractId, type: "sign", revokedAt: null }, data: { revokedAt: declinedAt } });
        await tx.contractEvent.create({ data: { contractId: link!.contractId, versionId: link!.version!.id, eventType: "signer_declined", metadata: { signerId: signer.id, role: signer.role, reason }, ipHash: hashRequestValue(ip) } });
      });
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: "declined", revoked: false, expired: false, rateLimited: false });
      await createNotification({ userId: link!.contract.userId, type: "contract_declined", title: "Acceptance changes requested", message: `${link!.signer!.name} requested changes to ${link!.contract.title}: ${reason.slice(0, 180)}`, href: `/workflow/contracts/${link!.contractId}` }).catch(() => undefined);
      return NextResponse.json({ success: true, declined: true, message: "The recorded-acceptance request was declined and the sender has been notified." });
    }
    const typedName = typeof body?.typedName === "string" ? body.typedName.trim().slice(0, 180) : "";
    if (!typedName) return NextResponse.json({ success: false, message: "Type your full name to record acceptance." }, { status: 400 });
    if (typedName.toLocaleLowerCase() !== link!.signer!.name.trim().toLocaleLowerCase()) return NextResponse.json({ success: false, message: "The typed name must match the named party. Ask the sender to correct the party details if needed." }, { status: 400 });
    if (body?.consentAccepted !== true) return NextResponse.json({ success: false, message: "You must confirm the recorded-acceptance consent before continuing." }, { status: 400 });
    const artifactToken = createAccessToken();

    type SignatureCompletion = {
      alreadySigned: boolean;
      completed: boolean;
      artifactHash: string | null;
      artifactToken: string | null;
    };
    let completion: SignatureCompletion;
    try {
      completion = await prisma.$transaction(async (tx) => {
      const signer = await tx.contractSigner.findUnique({ where: { id: link!.signer!.id } });
      if (!signer || signer.contractId !== link!.contractId) throw new Error("Acceptance party not found.");
      if (signer.status === "signed") {
        const currentContract = await tx.contract.findUnique({ where: { id: link!.contractId }, select: { status: true } });
        return { alreadySigned: true, completed: currentContract?.status === "executed", artifactHash: null as string | null, artifactToken: null as string | null };
      }
      if (signer.status !== "pending") throw new Error("This acceptance party is not allowed to record acceptance.");
      const prior = await tx.contractSigner.count({ where: { contractId: link!.contractId, sequence: { lt: signer.sequence }, status: { not: "signed" } } });
      if (prior > 0) throw new Error("The other party must record acceptance first. Use the client acceptance link before the owner link.");
      const signedAt = new Date();
      await tx.contractSignature.create({
        data: {
          contractId: link!.contractId,
          versionId: link!.version!.id,
          signerId: signer.id,
          signerRole: signer.role,
          signerName: signer.name,
          signerEmail: signer.email,
          signatureType: "typed",
          signatureValue: typedName,
          consentAccepted: true,
          consentTextVersion: CONTRACT_CONSENT_TEXT_VERSION,
          ipHash: hashRequestValue(ip),
          userAgentHash: hashRequestValue(req.headers.get("user-agent") || "unknown"),
          providerEventId: `${provider}_signature_${signedAt.getTime()}_${signer.id}`,
          providerPayload: { provider, demo: provider === "local", tokenWasPresented: true } as Prisma.InputJsonValue,
          signedAt,
        },
      });
      await tx.contractSigner.update({ where: { id: signer.id }, data: { status: "signed", signedAt } });
      await tx.contractEvent.create({ data: { contractId: link!.contractId, versionId: link!.version!.id, eventType: "signer_signed", metadata: { signerId: signer.id, role: signer.role, consentTextVersion: CONTRACT_CONSENT_TEXT_VERSION }, ipHash: hashRequestValue(ip) } });

      const remaining = await tx.contractSigner.count({ where: { contractId: link!.contractId, status: { not: "signed" } } });
      if (remaining > 0) return { alreadySigned: false, completed: false, artifactHash: null as string | null, artifactToken: null as string | null };

      const executedAt = new Date();
      const executed = await transitionContractStatus(tx, { where: { id: link!.contractId }, from: "signing", to: "executed", data: { executedAt, reviewExpiresAt: null } });
      if (executed !== 1) throw new Error("This Agreement was changed or voided before final acceptance was recorded.");
      const planItems = await tx.contractPaymentPlanItem.findMany({ where: { contractId: link!.contractId }, orderBy: { sequence: "asc" } });
      for (const item of planItems) {
        await tx.contractPaymentPlanItem.update({ where: { id: item.id }, data: { status: "active" } });
        await tx.contractBillingOccurrence.create({ data: { contractId: link!.contractId, paymentPlanItemId: item.id, status: item.triggerType === "on_signing" ? "eligible" : "pending", eligibleAt: item.triggerType === "on_signing" ? executedAt : null } });
      }
      await tx.contractEvent.create({ data: { contractId: link!.contractId, versionId: link!.version!.id, eventType: "contract_executed", metadata: { executedAt: executedAt.toISOString(), signedBy: "client_and_owner" } } });
       const allSignatures = await tx.contractSignature.findMany({ where: { contractId: link!.contractId, versionId: link!.version!.id }, orderBy: { signedAt: "asc" }, select: { id: true, signerRole: true, signerName: true, signerEmail: true, signatureType: true, consentAccepted: true, consentTextVersion: true, ipHash: true, userAgentHash: true, providerEventId: true, signedAt: true } });
       const evidence = {
         schemaVersion: 1,
         contractId: link!.contractId,
         versionId: link!.version!.id,
         documentHash: link!.version!.contentHash,
         provider: link!.contract.provider,
         providerEnvelopeId: link!.contract.providerEnvelopeId,
         executedAt: executedAt.toISOString(),
         consentText: CONTRACT_CONSENT_TEXT,
         signatures: allSignatures.map((signature) => ({ ...signature, signedAt: signature.signedAt.toISOString() })),
       };
       const artifactHash = sha256(stableStringify(evidence));
       await tx.contractArtifact.create({ data: { contractId: link!.contractId, versionId: link!.version!.id, artifactType: "signed_pdf", mimeType: "application/pdf", contentHash: artifactHash, content: evidence as unknown as Prisma.InputJsonValue } });
      await tx.contractReviewLink.create({ data: { contractId: link!.contractId, versionId: link!.version!.id, tokenHash: hashAccessToken(artifactToken), type: "artifact", expiresAt: new Date(executedAt.getTime() + 90 * 24 * 60 * 60 * 1000) } });
      return { alreadySigned: false, completed: true, artifactHash, artifactToken };
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const [currentSigner, currentContract] = await Promise.all([
        prisma.contractSigner.findUnique({ where: { id: link!.signer!.id }, select: { contractId: true, status: true } }),
        prisma.contract.findUnique({ where: { id: link!.contractId }, select: { status: true } }),
      ]);
      if (
        currentSigner?.contractId !== link!.contractId ||
        currentSigner.status !== "signed" ||
        !currentContract ||
        !["signing", "executed"].includes(currentContract.status)
      ) {
        throw error;
      }
      completion = {
        alreadySigned: true,
        completed: currentContract.status === "executed",
        artifactHash: null,
        artifactToken: null,
      };
    }

    if (completion.completed && completion.artifactToken) {
      const executed = await prisma.contract.findUnique({ where: { id: link!.contractId }, include: { client: { select: { name: true, email: true } } } });
      if (executed) {
        await recordActivationEvent(executed.userId, ACTIVATION_EVENTS.firstMeaningfulWorkflowCompleted, { contractId: executed.id, workflow: "contract_executed" });
        await processContractBilling({ userId: executed.userId, contractId: executed.id, limit: 100 }).catch((billingError) => console.error("Immediate contract billing check failed:", billingError));
        await createNotification({ userId: executed.userId, type: "contract_executed", title: "Agreement accepted", message: `${executed.title} has both parties’ acceptance recorded.`, href: `/workflow/contracts/${executed.id}` }).catch(() => undefined);
        const artifactUrl = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/public/contracts/artifact/${encodeURIComponent(completion.artifactToken || "")}`;
        if (executed.client.email) await sendContractExecutedEmail({ to: executed.client.email, recipientName: executed.client.name, contractTitle: executed.title, artifactUrl }).catch(() => undefined);
        const owner = await prisma.user.findUnique({ where: { id: executed.userId }, select: { email: true } });
        if (owner) await sendContractExecutedEmail({ to: owner.email, recipientName: owner.email, contractTitle: executed.title, artifactUrl }).catch(() => undefined);
      }
    }
    logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: completion.completed ? "accepted" : completion.alreadySigned ? "already_accepted" : "acceptance_recorded", revoked: false, expired: false, rateLimited: false });
    return NextResponse.json({ success: true, alreadySigned: completion.alreadySigned, completed: completion.completed, artifactHash: completion.artifactHash, downloadUrl: completion.completed ? completion.artifactToken ? `/api/public/contracts/artifact/${encodeURIComponent(completion.artifactToken)}` : `/api/public/contracts/sign/${encodeURIComponent(token)}/artifact` : null, message: completion.completed ? "Both parties have recorded acceptance. The accepted Agreement is ready." : completion.alreadySigned ? "This party has already recorded acceptance." : "Recorded acceptance saved. The next party can continue." });
  } catch (error) {
    console.error("Public contract sign error:", error);
    const message = error instanceof Error ? error.message : "Unable to record acceptance.";
    return NextResponse.json({ success: false, message }, { status: message.includes("production") ? 501 : message.includes("must sign first") ? 409 : 400 });
  }
}
