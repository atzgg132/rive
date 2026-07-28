import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { verifyToken } from "@/utils/auth";
import { createAuthToken } from "@/utils/authTokens";
import { sendWaitlistInviteEmail } from "@/utils/email";

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

    const { status } = await req.json();
    if (status !== "approved" && status !== "pending") {
      return NextResponse.json(
        { success: false, message: "status must be 'approved' or 'pending'." },
        { status: 400 },
      );
    }

    const entry = await prisma.waitlist.findUnique({ where: { id } });
    if (!entry) {
      return NextResponse.json({ success: false, message: "entry not found." }, { status: 404 });
    }

    if (status === "approved") {
      const { token } = await createAuthToken({
        email: entry.email,
        type: "waitlist_invite",
      });
      const emailResult = await sendWaitlistInviteEmail(entry.email, token);
      if (!emailResult.sent) {
        return NextResponse.json(
          {
            success: false,
            message:
              emailResult.reason === "not_configured"
                ? "Email delivery is not configured. The entry was not approved."
                : "The invitation could not be delivered. The entry was not approved.",
          },
          { status: 503 },
        );
      }
    } else {
      await prisma.authToken.updateMany({
        where: { email: entry.email, type: "waitlist_invite", usedAt: null },
        data: { usedAt: new Date() },
      });
    }

    const updated = await prisma.waitlist.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      message: status === "approved" ? "Approved and invitation sent." : "Approval revoked.",
      data: updated,
    });
  } catch (error: unknown) {
    console.error("Waitlist update error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
