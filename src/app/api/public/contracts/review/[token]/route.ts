import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { assertContractsEnabled, createNotification, getRequestIp, hashAccessToken, hashRequestValue, CONTRACT_MAX_COMMENT_LENGTH } from "@/utils/contracts";
import { rateLimit } from "@/utils/rateLimit";

async function resolveLink(token: string) {
  return prisma.contractReviewLink.findUnique({
    where: { tokenHash: hashAccessToken(token) },
    include: {
      contract: { include: { client: { select: { name: true, email: true } } } },
      version: true,
    },
  });
}

function invalidLink(link: Awaited<ReturnType<typeof resolveLink>>): string | null {
  if (!link || link.type !== "review") return "Review link not found.";
  if (link.revokedAt) return "This review link has been revoked. Ask the sender for a new link.";
  if (link.expiresAt <= new Date()) return "This review link has expired. Ask the sender for a new link.";
  if (!link.version) return "This review link is missing its contract version.";
  if (link.contract.status === "void") return "This contract has been voided.";
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    assertContractsEnabled();
    const { token } = await params;
    const link = await resolveLink(token);
    const problem = invalidLink(link);
    if (problem) return NextResponse.json({ success: false, message: problem }, { status: problem.includes("not found") ? 404 : 410 });
    await prisma.contractReviewLink.update({ where: { id: link!.id }, data: { lastAccessedAt: new Date() } });

    const content = link!.version!.content as { title?: string; ownerName?: string; ownerEmail?: string; clientName?: string; clientEmail?: string | null; clientCompany?: string | null; clientAddress?: string | null; projectTitle?: string | null; projectDescription?: string | null; governingLaw?: string; jurisdiction?: string | null; sections?: unknown; paymentPlan?: unknown };
    const comments = await prisma.contractComment.findMany({
      where: { contractId: link!.contractId, versionId: link!.versionId },
      orderBy: { createdAt: "asc" },
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
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Public contract review fetch error:", error);
    return NextResponse.json({ success: false, message: "Unable to load this review link." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    assertContractsEnabled();
    const { token } = await params;
    const link = await resolveLink(token);
    const problem = invalidLink(link);
    if (problem) return NextResponse.json({ success: false, message: problem }, { status: problem.includes("not found") ? 404 : 410 });
    if (link!.contract.status === "ready_to_sign" || link!.contract.status === "executed" || link!.version!.status === "approved") return NextResponse.json({ success: false, message: "This version is no longer accepting review comments." }, { status: 409 });
    const ip = getRequestIp(req);
    if (!rateLimit(`contract-review:${link!.id}:${hashRequestValue(ip)}`, 20, 60 * 60 * 1000)) return NextResponse.json({ success: false, message: "Too many comments from this link. Try again later." }, { status: 429 });
    const body = await req.json().catch(() => null) as { action?: unknown; authorName?: unknown; authorEmail?: unknown; sectionKey?: unknown; body?: unknown } | null;
    const authorName = typeof body?.authorName === "string" ? body.authorName.trim().slice(0, 120) : "";
    const authorEmail = typeof body?.authorEmail === "string" ? body.authorEmail.trim().slice(0, 254).toLowerCase() : "";
    if (body?.action === "approve") {
      const reviewerName = authorName || link!.contract.client.name;
      await prisma.$transaction(async (tx) => {
        const approved = await tx.contractVersion.updateMany({
          where: { id: link!.version!.id, contractId: link!.contractId, status: { in: ["draft", "approved"] } },
          data: { status: "approved" },
        });
        if (approved.count !== 1) throw new Error("This contract version changed while approval was being recorded.");
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
      await createNotification({ userId: link!.contract.userId, type: "contract_review_approved", title: "Contract review approved", message: `${reviewerName} marked ${link!.contract.title} ready for finalization.`, href: `/workflow/contracts/${link!.contractId}` }).catch(() => undefined);
      return NextResponse.json({ success: true, approved: true, message: "The sender has been told this draft is ready for finalization." });
    }
    const commentBody = typeof body?.body === "string" ? body.body.trim().slice(0, CONTRACT_MAX_COMMENT_LENGTH) : "";
    const sectionKey = typeof body?.sectionKey === "string" ? body.sectionKey.trim().slice(0, 80) : null;
    if (authorName.length < 2) return NextResponse.json({ success: false, message: "Enter your name so the sender can identify the comment." }, { status: 400 });
    if (authorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail)) return NextResponse.json({ success: false, message: "Enter a valid email or leave it blank." }, { status: 400 });
    if (!commentBody) return NextResponse.json({ success: false, message: "Write a comment before submitting." }, { status: 400 });
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.contractComment.create({ data: { contractId: link!.contractId, versionId: link!.versionId, reviewLinkId: link!.id, authorRole: "client", authorName, authorEmail: authorEmail || null, sectionKey: sectionKey || null, body: commentBody } });
      await tx.contractEvent.create({ data: { contractId: link!.contractId, versionId: link!.versionId, eventType: "client_comment_added", metadata: { commentId: created.id, sectionKey: sectionKey || null }, ipHash: hashRequestValue(ip) } });
      return created;
    });
    await createNotification({ userId: link!.contract.userId, type: "contract_comment", title: "Client commented on a contract", message: `${authorName} commented on ${link!.contract.title}.`, href: `/workflow/contracts/${link!.contractId}` }).catch(() => undefined);
    return NextResponse.json({ success: true, comment: { id: comment.id, authorRole: comment.authorRole, authorName: comment.authorName, sectionKey: comment.sectionKey, body: comment.body, status: comment.status, createdAt: comment.createdAt }, message: "Comment added." }, { status: 201 });
  } catch (error) {
    console.error("Public contract comment error:", error);
    return NextResponse.json({ success: false, message: "Unable to add this comment." }, { status: 500 });
  }
}
