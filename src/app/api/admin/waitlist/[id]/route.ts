import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { verifyToken } from "@/utils/auth";
import { prepareAuthToken } from "@/utils/authTokens";
import { sendWaitlistInviteEmail } from "@/utils/email";
import { getWaitlistOperationalDetails } from "@/utils/waitlistAdmin";

async function responseData(entry: {
  id: number;
  email: string;
  type: string;
  status: string;
  createdAt: Date;
}) {
  const details = (await getWaitlistOperationalDetails([entry.email])).get(entry.email.toLowerCase());
  const registered = details?.registered || false;
  return {
    ...entry,
    created_at: entry.createdAt,
    registered,
    registered_at: details?.registeredAt || null,
    invite_status: registered
      ? "registered"
      : entry.status === "pending"
        ? "not_sent"
        : details?.inviteStatus || "not_sent",
    invite_expires_at: details?.inviteExpiresAt || null,
    latest_delivery_status: details?.latestDeliveryStatus || null,
    latest_delivery_at: details?.latestDeliveryAt || null,
  };
}

async function deliverInvitation({
  email,
  token,
  tokenId,
  auditAction,
  waitlistId,
}: {
  email: string;
  token: string;
  tokenId: string;
  auditAction: "waitlist.invite_sent" | "waitlist.invite_resent";
  waitlistId: number;
}) {
  const emailResult = await sendWaitlistInviteEmail(email, token);

  if (emailResult.sent) {
    const now = new Date();
    await prisma.authToken.updateMany({
      where: {
        email: email.trim().toLowerCase(),
        type: "waitlist_invite",
        usedAt: null,
        id: { not: tokenId },
      },
      data: { usedAt: now },
    });
  } else {
    // Do not revoke the new token when SMTP reports a failure. A provider can
    // accept a message and then fail before the application receives the
    // response; the recipient may still receive the link later or in spam.
    // A later successful resend revokes every older unused token atomically
    // from the application's point of view.
  }

  await prisma.auditEvent.create({
    data: {
      action: emailResult.sent ? auditAction : "waitlist.invite_delivery_failed",
      targetType: "waitlist",
      targetId: String(waitlistId),
      metadata: {
        email,
        reason: emailResult.reason || null,
      },
    },
  }).catch((error) => console.error("Waitlist audit event failed:", error));

  return emailResult;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyToken(req.headers.get("x-admin-token"))) {
    return NextResponse.json({ success: false, message: "unauthorised." }, { status: 401 });
  }

  try {
    const { id: rawId } = await params;
    const id = Number.parseInt(rawId, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ success: false, message: "invalid id." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, message: "A valid request body is required." }, { status: 400 });
    }

    const action = body.action === "resend_invite" ? "resend_invite" : null;
    const status = body.status;
    if (!action && status !== "approved" && status !== "pending") {
      return NextResponse.json(
        { success: false, message: "status must be 'approved' or 'pending'." },
        { status: 400 },
      );
    }

    const entry = await prisma.waitlist.findUnique({ where: { id } });
    if (!entry) {
      return NextResponse.json({ success: false, message: "entry not found." }, { status: 404 });
    }

    const registeredUser = await prisma.user.findUnique({
      where: { email: entry.email },
      select: { id: true },
    });

    if (action === "resend_invite") {
      if (registeredUser) {
        return NextResponse.json(
          { success: false, message: "This person has already registered." },
          { status: 409 },
        );
      }
      if (entry.status !== "approved") {
        return NextResponse.json(
          { success: false, message: "Approve this entry before sending an invitation." },
          { status: 409 },
        );
      }

      const prepared = prepareAuthToken({ email: entry.email, type: "waitlist_invite" });
      const invitation = await prisma.authToken.create({ data: prepared.data });
      const emailResult = await deliverInvitation({
        email: entry.email,
        token: prepared.token,
        tokenId: invitation.id,
        auditAction: "waitlist.invite_resent",
        waitlistId: entry.id,
      });

      return NextResponse.json({
        success: true,
        emailSent: emailResult.sent,
        message: emailResult.sent
          ? "Invitation sent again."
          : "The invitation could not be delivered. Any previously delivered link remains active.",
        data: await responseData(entry),
      });
    }

    if (status === "pending") {
      if (registeredUser) {
        return NextResponse.json(
          { success: false, message: "A registered account cannot be revoked from the waitlist." },
          { status: 409 },
        );
      }

      const revokedAt = new Date();
      const updated = await prisma.$transaction(async (transaction) => {
        await transaction.authToken.updateMany({
          where: { email: entry.email, type: "waitlist_invite", usedAt: null },
          data: { usedAt: revokedAt },
        });
        const result = await transaction.waitlist.update({
          where: { id },
          data: { status: "pending" },
        });
        await transaction.auditEvent.create({
          data: {
            action: "waitlist.approval_revoked",
            targetType: "waitlist",
            targetId: String(id),
            metadata: { email: entry.email },
          },
        });
        return result;
      });

      return NextResponse.json({
        success: true,
        message: "Approval revoked.",
        data: await responseData(updated),
      });
    }

    if (registeredUser) {
      const updated = entry.status === "approved"
        ? entry
        : await prisma.waitlist.update({ where: { id }, data: { status: "approved" } });
      return NextResponse.json({
        success: true,
        emailSent: false,
        message: "This person is already registered.",
        data: await responseData(updated),
      });
    }

    if (entry.status === "approved") {
      return NextResponse.json({
        success: true,
        emailSent: false,
        message: "This entry is already approved. Use resend to issue another invitation.",
        data: await responseData(entry),
      });
    }

    const prepared = prepareAuthToken({ email: entry.email, type: "waitlist_invite" });
    const approved = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.waitlist.update({
        where: { id },
        data: { status: "approved" },
      });
      const invitation = await transaction.authToken.create({ data: prepared.data });
      await transaction.auditEvent.create({
        data: {
          action: "waitlist.approved",
          targetType: "waitlist",
          targetId: String(id),
          metadata: { email: entry.email },
        },
      });
      return { updated, invitation };
    });

    const emailResult = await deliverInvitation({
      email: entry.email,
      token: prepared.token,
      tokenId: approved.invitation.id,
      auditAction: "waitlist.invite_sent",
      waitlistId: entry.id,
    });

    return NextResponse.json({
      success: true,
      emailSent: emailResult.sent,
      message: emailResult.sent
        ? "Approved and invitation sent."
        : "Approved, but the invitation could not be delivered. You can retry from the admin dashboard.",
      data: await responseData(approved.updated),
    });
  } catch (error: unknown) {
    console.error("Waitlist update error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
