import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { buildContractExecutedEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
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
  transitionContractStatus,
} from "@/utils/contracts";
import {
  contractAcceptanceLinkProblem,
  contractPublicSessionLogOutcome,
  contractPublicSessionMessage,
  isContractPublicSessionSegment,
  readContractPublicSessionToken,
  resolveContractPublicSession,
} from "@/utils/contractPublicSession";
import { ensureContractExecutedArtifact } from "@/utils/contractArtifacts";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { createNotification } from "@/utils/contracts";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { ensureAcceptedAgreementWorkSetup } from "@/utils/projectGeneration";
import { readJsonBody } from "@/utils/apiBoundary";

const LINK_INCLUDE = {
  contract: { include: { client: { select: { name: true, email: true } }, user: { select: { email: true } } } },
  version: true,
  signer: true,
} satisfies Prisma.ContractReviewLinkInclude;

async function resolveLink(token: string) {
  return prisma.contractReviewLink.findUnique({
    where: { tokenHash: hashAccessToken(token) },
    include: LINK_INCLUDE,
  });
}

async function resolveLinkById(id: string) {
  return prisma.contractReviewLink.findUnique({
    where: { id },
    include: LINK_INCLUDE,
  });
}

/**
 * Bearer token or public-session lookup. The reserved "session" segment reads
 * the purpose-bound HttpOnly cookie; anything else keeps the legacy
 * bearer-token compatibility path. Session rows only ever carry the token
 * hash, and a session is rejected when its parent link has since been revoked
 * or expired.
 */
async function resolveRequestLink(req: NextRequest, token: string): Promise<
  | { link: Awaited<ReturnType<typeof resolveLink>>; session: null }
  | { link: null; session: { reason: string; contractId: string | null; versionId: string | null } }
> {
  if (!isContractPublicSessionSegment(token)) return { link: await resolveLink(token), session: null };
  const resolved = await resolveContractPublicSession(prisma, {
    purpose: "acceptance",
    token: readContractPublicSessionToken(req, "acceptance"),
  });
  if (!resolved.ok) {
    return {
      link: null,
      session: { reason: resolved.reason, contractId: resolved.session?.contractId || null, versionId: resolved.session?.versionId || null },
    };
  }
  return { link: await resolveLinkById(resolved.session.linkId), session: null };
}

function sessionFailureResponse(req: NextRequest, requestId: string, failure: { reason: string; contractId: string | null; versionId: string | null }) {
  logContractPublicLinkAccess({
    request: req,
    requestId,
    purpose: "acceptance",
    contractId: failure.contractId,
    versionId: failure.versionId,
    outcome: contractPublicSessionLogOutcome(failure.reason as Parameters<typeof contractPublicSessionLogOutcome>[0]),
    revoked: failure.reason === "revoked" || failure.reason === "link_revoked" ? true : null,
    expired: failure.reason === "expired" || failure.reason === "link_expired" ? true : null,
    rateLimited: false,
  });
  return NextResponse.json(
    { success: false, message: contractPublicSessionMessage("acceptance") },
    { status: ["expired", "revoked", "link_expired", "link_revoked"].includes(failure.reason) ? 410 : 401 },
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;
    const ip = getRequestIp(req);
    const tokenKey = isContractPublicSessionSegment(token)
      ? hashRequestValue(readContractPublicSessionToken(req, "acceptance") || "missing")
      : hashAccessToken(token);
    if (!(await durableRateLimit(`contract-sign-get:${tokenKey}:${hashRequestValue(ip)}`, 60, 60 * 60 * 1000)) || !(await durableRateLimit("contract-sign-get:global", 600, 60 * 60 * 1000))) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: null, versionId: null, outcome: "rate_limited", revoked: null, expired: null, rateLimited: true });
      return NextResponse.json({ success: false, message: "Too many requests. Try again later." }, { status: 429 });
    }
    const resolved = await resolveRequestLink(req, token);
    if (resolved.session) return sessionFailureResponse(req, requestId, resolved.session);
    const link = resolved.link;
    const problem = contractAcceptanceLinkProblem(link);
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
    }, { headers: { "Cache-Control": "no-store", "Vary": "Cookie" } });
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
    const resolved = await resolveRequestLink(req, token);
    if (resolved.session) return sessionFailureResponse(req, requestId, resolved.session);
    const link = resolved.link;
    const problem = contractAcceptanceLinkProblem(link);
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      return NextResponse.json({ success: false, message: problem }, { status: problem.includes("not found") ? 404 : 410 });
    }
    if (link!.type !== "sign") {
      return NextResponse.json({ success: false, message: "This is a void-confirmation link. Use the void controls on the page." }, { status: 409 });
    }
    const ip = getRequestIp(req);
    if (!(await durableRateLimit(`contract-sign:${link!.id}:${hashRequestValue(ip)}`, 5, 60 * 60 * 1000))) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: "rate_limited", revoked: false, expired: false, rateLimited: true });
      return NextResponse.json({ success: false, message: "Too many acceptance attempts. Try again later." }, { status: 429 });
    }
    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
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
    if (typedName.toLocaleLowerCase() !== link!.signer!.name.trim().toLocaleLowerCase()) {
      return NextResponse.json({
        success: false,
        message: `The typed name must match the named party exactly (ignore capitalization): “${link!.signer!.name}”. Ask the sender to edit the Agreement and save a new version if that party name is wrong.`,
      }, { status: 400 });
    }
    if (body?.consentAccepted !== true) return NextResponse.json({ success: false, message: "You must confirm the recorded-acceptance consent before continuing." }, { status: 400 });
    const artifactToken = createAccessToken();

    type SignatureCompletion = {
      alreadySigned: boolean;
      completed: boolean;
      artifactToken: string | null;
      executedMailJobIds: string[];
    };
    let completion: SignatureCompletion;
    try {
      completion = await prisma.$transaction(async (tx) => {
      const signer = await tx.contractSigner.findUnique({ where: { id: link!.signer!.id } });
      if (!signer || signer.contractId !== link!.contractId) throw new Error("Acceptance party not found.");
      if (signer.status === "signed") {
        const currentContract = await tx.contract.findUnique({ where: { id: link!.contractId }, select: { status: true } });
        return { alreadySigned: true, completed: currentContract?.status === "executed", artifactToken: null as string | null, executedMailJobIds: [] as string[] };
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
      if (remaining > 0) return { alreadySigned: false, completed: false, artifactToken: null as string | null, executedMailJobIds: [] as string[] };

      const executedAt = new Date();
      const executed = await transitionContractStatus(tx, { where: { id: link!.contractId }, from: "signing", to: "executed", data: { executedAt, reviewExpiresAt: null } });
      if (executed !== 1) throw new Error("This Agreement was changed or voided before final acceptance was recorded.");
      await tx.contractEvent.create({ data: { contractId: link!.contractId, versionId: link!.version!.id, eventType: "contract_executed", metadata: { executedAt: executedAt.toISOString(), signedBy: "client_and_owner" } } });
      // The signed_pdf artifact row is written after commit by
      // ensureContractExecutedArtifact so the recorded hash is the hash of the
      // actual stored bytes — evidence can never point at a render that failed.
      await tx.contractReviewLink.create({ data: { contractId: link!.contractId, versionId: link!.version!.id, tokenHash: hashAccessToken(artifactToken), type: "artifact", expiresAt: new Date(executedAt.getTime() + 90 * 24 * 60 * 60 * 1000) } });
      const artifactUrl = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/public/contracts/artifact/${encodeURIComponent(artifactToken)}`;
      const executedMailJobIds: string[] = [];
      if (link!.contract.client.email) {
        executedMailJobIds.push(await enqueueEmail(buildContractExecutedEmail({ to: link!.contract.client.email, recipientName: link!.contract.client.name, contractTitle: link!.contract.title, artifactUrl }), tx));
      }
      executedMailJobIds.push(await enqueueEmail(buildContractExecutedEmail({ to: link!.contract.user.email, recipientName: link!.contract.user.email, contractTitle: link!.contract.title, artifactUrl }), tx));
      return { alreadySigned: false, completed: true, artifactToken, executedMailJobIds };
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
        artifactToken: null,
        executedMailJobIds: [],
      };
    }

    // Render + store the executed artifact once, outside the status
    // transaction: bytes are hashed and stored (S3 or DB) and the row is
    // append-only. A failure here leaves the contract executed and lets the
    // download route self-heal the missing artifact on first access.
    let artifactHash: string | null = null;
    if (completion.completed) {
      const artifact = await ensureContractExecutedArtifact(prisma, { contractId: link!.contractId, versionId: link!.version!.id }).catch((artifactError) => {
        console.error("Executed Agreement artifact render/store failed:", artifactError);
        return null;
      });
      artifactHash = artifact?.contentHash || null;
    }
    if (completion.completed) {
      await ensureAcceptedAgreementWorkSetup(prisma, {
        userId: link!.contract.userId,
        contractId: link!.contractId,
        acceptedVersionId: link!.version!.id,
      }).catch((error) => {
        console.error("Post-acceptance work-setup backfill failed:", error);
      });
    }
    if (completion.completed && completion.artifactToken) {
      const executed = await prisma.contract.findUnique({ where: { id: link!.contractId }, include: { client: { select: { name: true, email: true } } } });
      if (executed) {
        await recordActivationEvent(executed.userId, ACTIVATION_EVENTS.firstMeaningfulWorkflowCompleted, { contractId: executed.id, workflow: "contract_executed" });
        await recordProductEvent({ userId: executed.userId, eventName: PRODUCT_EVENTS.agreementAccepted, module: "agreements", entityType: "contract", entityId: executed.id, source: "public_acceptance", dedupeKey: `agreement_accepted:${executed.id}` });
        await createNotification({ userId: executed.userId, type: "contract_work_setup", title: "Agreement accepted — set up the work", message: `${executed.title} has both parties’ acceptance recorded. Set up the work when you’re ready.`, href: `/workflow/contracts/${executed.id}` }).catch(() => undefined);
        if (getEmailProvider() !== "disabled") {
          for (const jobId of completion.executedMailJobIds) {
            await processEmailOutbox({ jobId }).catch((mailError) => console.error("Immediate executed Agreement mail attempt failed:", mailError));
          }
        }
      }
    }
    logContractPublicLinkAccess({ request: req, requestId, purpose: "acceptance", contractId: link!.contractId, versionId: link!.versionId, outcome: completion.completed ? "accepted" : completion.alreadySigned ? "already_accepted" : "acceptance_recorded", revoked: false, expired: false, rateLimited: false });
    return NextResponse.json({ success: true, alreadySigned: completion.alreadySigned, completed: completion.completed, artifactHash, downloadUrl: completion.completed ? `/api/public/contracts/sign/${encodeURIComponent(token)}/artifact` : null, message: completion.completed ? "Both parties have recorded acceptance. The accepted Agreement is ready." : completion.alreadySigned ? "This party has already recorded acceptance." : "Recorded acceptance saved. The next party can continue." });
  } catch (error) {
    console.error("Public contract sign error:", error);
    const message = error instanceof Error ? error.message : "Unable to record acceptance.";
    return NextResponse.json({ success: false, message }, { status: message.includes("production") ? 501 : message.includes("must sign first") ? 409 : 400 });
  }
}
