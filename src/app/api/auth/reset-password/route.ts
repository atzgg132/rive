import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { findValidAuthToken } from "@/utils/authTokens";
import { hashPassword } from "@/utils/userAuth";
import { sendPasswordChangedEmail } from "@/utils/email";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    if (!rateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
    }

    const body = await req.json();
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8) {
      return NextResponse.json({ success: false, message: "Use at least 8 characters for your new password." }, { status: 400 });
    }

    const resetToken = await findValidAuthToken(token, "password_reset");
    if (!resetToken || !resetToken.userId) {
      return NextResponse.json({ success: false, message: "This reset link is invalid or has expired." }, { status: 400 });
    }

    const changed = await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.authToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return false;

      await transaction.user.update({
        where: { id: resetToken.userId! },
        data: { passwordHash: hashPassword(password), sessionVersion: { increment: 1 } },
      });
      await transaction.authToken.updateMany({
        where: { userId: resetToken.userId, type: "password_reset", usedAt: null },
        data: { usedAt: new Date() },
      });
      return true;
    });

    if (!changed) {
      return NextResponse.json({ success: false, message: "This reset link has already been used." }, { status: 409 });
    }

    await sendPasswordChangedEmail(resetToken.email);
    return NextResponse.json({ success: true, message: "Your password has been updated. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ success: false, message: "We could not reset your password. Please try again." }, { status: 500 });
  }
}
