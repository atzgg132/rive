import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { assertContractsEnabled, CONTRACT_MAX_COMMENT_LENGTH } from "@/utils/contracts";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => null) as { body?: unknown; sectionKey?: unknown } | null;
    const commentBody = typeof body?.body === "string" ? body.body.trim().slice(0, CONTRACT_MAX_COMMENT_LENGTH) : "";
    const sectionKey = typeof body?.sectionKey === "string" ? body.sectionKey.trim().slice(0, 80) : null;
    if (!commentBody) return NextResponse.json({ success: false, message: "Write a comment before submitting." }, { status: 400 });
    const contract = await prisma.contract.findFirst({ where: { id, userId: session.userId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!contract) return NextResponse.json({ success: false, message: "Agreement not found." }, { status: 404 });
    if (!contract.versions[0]) return NextResponse.json({ success: false, message: "Agreement version not found." }, { status: 409 });
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.contractComment.create({ data: { contractId: id, versionId: contract.versions[0].id, authorUserId: session.userId, authorRole: "owner", authorName: session.email, authorEmail: session.email, sectionKey, body: commentBody } });
      await tx.contractEvent.create({ data: { contractId: id, versionId: contract.versions[0].id, actorUserId: session.userId, eventType: "owner_comment_added", metadata: { commentId: created.id, sectionKey } } });
      return created;
    });
    return NextResponse.json({ success: true, comment: { id: comment.id, authorRole: comment.authorRole, authorName: comment.authorName, sectionKey: comment.sectionKey, body: comment.body, status: comment.status, createdAt: comment.createdAt } }, { status: 201 });
  } catch (error) {
    console.error("Owner contract comment error:", error);
    return NextResponse.json({ success: false, message: "Unable to add comment." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertContractsEnabled();
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => null) as { commentId?: unknown; status?: unknown } | null;
    const commentId = typeof body?.commentId === "string" ? body.commentId : "";
    const status = body?.status === "resolved" ? "resolved" : body?.status === "open" ? "open" : "";
    if (!commentId || !status) return NextResponse.json({ success: false, message: "Comment ID and a valid status are required." }, { status: 400 });
    const comment = await prisma.contractComment.findFirst({ where: { id: commentId, contractId: id, contract: { userId: session.userId } } });
    if (!comment) return NextResponse.json({ success: false, message: "Comment not found." }, { status: 404 });
    const updated = await prisma.contractComment.update({ where: { id: commentId }, data: { status, resolvedAt: status === "resolved" ? new Date() : null } });
    await prisma.contractEvent.create({ data: { contractId: id, versionId: updated.versionId, actorUserId: session.userId, eventType: status === "resolved" ? "comment_resolved" : "comment_reopened", metadata: { commentId } } });
    return NextResponse.json({ success: true, comment: { id: updated.id, status: updated.status, resolvedAt: updated.resolvedAt } });
  } catch (error) {
    console.error("Owner contract comment update error:", error);
    return NextResponse.json({ success: false, message: "Unable to update comment." }, { status: 500 });
  }
}
