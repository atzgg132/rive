import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { assertContractsEnabled, classifyContractPublicLinkFailure, createNotification, getRequestId, getRequestIp, hashAccessToken, hashRequestValue, logContractPublicLinkAccess, CONTRACT_MAX_COMMENT_LENGTH } from "@/utils/contracts";
import {
  contractPublicSessionLogOutcome,
  contractPublicSessionMessage,
  contractReviewLinkProblem,
  isContractPublicSessionSegment,
  readContractPublicSessionToken,
  resolveContractPublicSession,
} from "@/utils/contractPublicSession";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { normalizeEmailAddress } from "@/lib/email-address";
import { readJsonBody } from "@/utils/apiBoundary";

const LINK_INCLUDE = {
  contract: { include: { client: { select: { name: true, email: true } } } },
  version: true,
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

// The reserved "session" segment resolves the purpose-bound HttpOnly cookie;
// any other segment keeps the bearer-token compatibility path.
async function resolveRequestLink(req: NextRequest, token: string): Promise<
  | { link: Awaited<ReturnType<typeof resolveLink>>; session: null }
  | { link: null; session: { reason: string; contractId: string | null; versionId: string | null } }
> {
  if (!isContractPublicSessionSegment(token)) return { link: await resolveLink(token), session: null };
  const resolved = await resolveContractPublicSession(prisma, {
    purpose: "review",
    token: readContractPublicSessionToken(req, "review"),
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
    purpose: "review",
    contractId: failure.contractId,
    versionId: failure.versionId,
    outcome: contractPublicSessionLogOutcome(failure.reason as Parameters<typeof contractPublicSessionLogOutcome>[0]),
    revoked: failure.reason === "revoked" || failure.reason === "link_revoked" ? true : null,
    expired: failure.reason === "expired" || failure.reason === "link_expired" ? true : null,
    rateLimited: false,
  });
  return NextResponse.json(
    { success: false, message: contractPublicSessionMessage("review") },
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
      ? hashRequestValue(readContractPublicSessionToken(req, "review") || "missing")
      : hashAccessToken(token);
    if (!(await durableRateLimit(`contract-review-get:${tokenKey}:${hashRequestValue(ip)}`, 60, 60 * 60 * 1000)) || !(await durableRateLimit("contract-review-get:global", 600, 60 * 60 * 1000))) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "review", contractId: null, versionId: null, outcome: "rate_limited", revoked: null, expired: null, rateLimited: true });
      return NextResponse.json({ success: false, message: "Too many requests. Try again later." }, { status: 429 });
    }
    const resolved = await resolveRequestLink(req, token);
    if (resolved.session) return sessionFailureResponse(req, requestId, resolved.session);
    const link = resolved.link;
    const problem = contractReviewLinkProblem(link);
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "review", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      return NextResponse.json({ success: false, message: problem }, { status: problem.includes("not found") ? 404 : 410 });
    }
    await prisma.contractReviewLink.update({ where: { id: link!.id }, data: { lastAccessedAt: new Date() } });
    logContractPublicLinkAccess({ request: req, requestId, purpose: "review", contractId: link!.contractId, versionId: link!.versionId, outcome: "allowed", revoked: false, expired: false, rateLimited: false });

    const content = link!.version!.content as { title?: string; ownerName?: string; ownerEmail?: string; clientName?: string; clientEmail?: string | null; clientCompany?: string | null; clientAddress?: string | null; projectTitle?: string | null; projectDescription?: string | null; governingLaw?: string; jurisdiction?: string | null; sections?: unknown; paymentPlan?: unknown };
    const comments = await prisma.contractComment.findMany({
      where: { contractId: link!.contractId, versionId: link!.versionId },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: { id: true, authorRole: true, authorName: true, sectionKey: true, body: true, status: true, resolvedAt: true, createdAt: true },
    });
    return NextResponse.json({
      success: true,
      mode: link!.contract.status === "ready_to_sign" || link!.contract.status === "executed" || link!.version!.status === "approved" ? "read_only" : "review",
      contract: {
        id: link!.contract.id,
        title: link!.contract.title,
        status: link!.contract.status,
        provider: link!.contract.provider,
        governing_law: content.governingLaw || link!.contract.governingLaw,
        jurisdiction: content.jurisdiction ?? link!.contract.jurisdiction,
        currency: link!.contract.currency,
        client_name: link!.contract.client.name,
        content,
        version: { id: link!.version!.id, number: link!.version!.version, status: link!.version!.status, hash: link!.version!.contentHash, created_at: link!.version!.createdAt },
        comments,
        expires_at: link!.expiresAt,
      },
    }, { headers: { "Cache-Control": "no-store", "Vary": "Cookie" } });
  } catch (error) {
    console.error("Public contract review fetch error:", error);
    return NextResponse.json({ success: false, message: "Unable to load this review link." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(req);
  try {
    assertContractsEnabled();
    const { token } = await params;
    const resolved = await resolveRequestLink(req, token);
    if (resolved.session) return sessionFailureResponse(req, requestId, resolved.session);
    const link = resolved.link;
    const problem = contractReviewLinkProblem(link);
    if (problem) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "review", contractId: link?.contractId || null, versionId: link?.versionId || null, outcome: classifyContractPublicLinkFailure(problem), revoked: Boolean(link?.revokedAt), expired: Boolean(link && link.expiresAt <= new Date()), rateLimited: false });
      return NextResponse.json({ success: false, message: problem }, { status: problem.includes("not found") ? 404 : 410 });
    }
    if (link!.contract.status === "ready_to_sign" || link!.contract.status === "executed" || link!.version!.status === "approved") {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "review", contractId: link!.contractId, versionId: link!.versionId, outcome: "read_only_mutation_rejected", revoked: false, expired: false, rateLimited: false });
      return NextResponse.json({ success: false, message: "This version is no longer accepting review comments." }, { status: 409 });
    }
    const ip = getRequestIp(req);
    if (!(await durableRateLimit(`contract-review:${link!.id}:${hashRequestValue(ip)}`, 20, 60 * 60 * 1000))) {
      logContractPublicLinkAccess({ request: req, requestId, purpose: "review", contractId: link!.contractId, versionId: link!.versionId, outcome: "rate_limited", revoked: false, expired: false, rateLimited: true });
      return NextResponse.json({ success: false, message: "Too many comments from this link. Try again later." }, { status: 429 });
    }
    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const authorName = typeof body?.authorName === "string" ? body.authorName.trim().slice(0, 120) : "";
    const authorEmailInput = typeof body?.authorEmail === "string" ? body.authorEmail.trim() : "";
    const authorEmail = authorEmailInput ? normalizeEmailAddress(authorEmailInput) : null;
    if (authorEmailInput && !authorEmail) {
      return NextResponse.json(
        { success: false, message: "Enter a valid email or leave it blank." },
        { status: 400 },
      );
    }
    if (body?.action === "approve") {
      const reviewerName = authorName || link!.contract.client.name;
      await prisma.$transaction(async (tx) => {
        const approved = await tx.contractVersion.updateMany({
          where: { id: link!.version!.id, contractId: link!.contractId, status: { in: ["draft", "approved"] } },
          data: { status: "approved" },
        });
        if (approved.count !== 1) throw new Error("This Agreement version changed while approval was being recorded.");
        await tx.contractEvent.create({
          data: {
            contractId: link!.contractId,
            versionId: link!.version!.id,
            eventType: "client_review_approved",
            metadata: { reviewerName, reviewerEmail: authorEmail || link!.contract.client.email || null },
            ipHash: hashRequestValue(ip),
          },
        });
      });
      logContractPublicLinkAccess({ request: req, requestId, purpose: "review", contractId: link!.contractId, versionId: link!.versionId, outcome: "approval_recorded", revoked: false, expired: false, rateLimited: false });
      await createNotification({ userId: link!.contract.userId, type: "contract_review_approved", title: "Agreement review approved", message: `${reviewerName} marked ${link!.contract.title} ready for finalization.`, href: `/workflow/contracts/${link!.contractId}` }).catch(() => undefined);
      return NextResponse.json({ success: true, approved: true, message: "The sender has been told this Agreement version is ready for finalization and recorded acceptance." });
    }
    const commentBody = typeof body?.body === "string" ? body.body.trim().slice(0, CONTRACT_MAX_COMMENT_LENGTH) : "";
    const sectionKey = typeof body?.sectionKey === "string" ? body.sectionKey.trim().slice(0, 80) : null;
    if (authorName.length < 2) return NextResponse.json({ success: false, message: "Enter your name so the sender can identify the comment." }, { status: 400 });
    if (!commentBody) return NextResponse.json({ success: false, message: "Write a comment before submitting." }, { status: 400 });
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.contractComment.create({ data: { contractId: link!.contractId, versionId: link!.versionId, reviewLinkId: link!.id, authorRole: "client", authorName, authorEmail, sectionKey: sectionKey || null, body: commentBody } });
      await tx.contractEvent.create({ data: { contractId: link!.contractId, versionId: link!.version!.id, eventType: "client_comment_added", metadata: { commentId: created.id, sectionKey: sectionKey || null }, ipHash: hashRequestValue(ip) } });
      return created;
    });
    logContractPublicLinkAccess({ request: req, requestId, purpose: "review", contractId: link!.contractId, versionId: link!.versionId, outcome: "comment_recorded", revoked: false, expired: false, rateLimited: false });
    await createNotification({ userId: link!.contract.userId, type: "contract_comment", title: "Client commented on an Agreement", message: `${authorName} commented on ${link!.contract.title}.`, href: `/workflow/contracts/${link!.contractId}` }).catch(() => undefined);
    return NextResponse.json({ success: true, comment: { id: comment.id, authorRole: comment.authorRole, authorName: comment.authorName, sectionKey: comment.sectionKey, body: comment.body, status: comment.status, createdAt: comment.createdAt }, message: "Comment added." }, { status: 201 });
  } catch (error) {
    console.error("Public contract comment error:", error);
    return NextResponse.json({ success: false, message: "Unable to add this comment." }, { status: 500 });
  }
}
