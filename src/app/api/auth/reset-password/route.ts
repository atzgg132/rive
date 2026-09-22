import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { findValidAuthToken } from "@/utils/authTokens";
import { hashPassword } from "@/utils/userAuth";
import { buildPasswordChangedEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { readJsonBody } from "@/utils/apiBoundary";

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    if (!rateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
    }

    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8) {
      return NextResponse.json({ success: false, message: "Use at least 8 characters for your new password." }, { status: 400 });
    }

    const resetToken = await findValidAuthToken(token, "password_reset");
    if (!resetToken || !resetToken.userId) {
      return NextResponse.json({ success: false, message: "This reset link is invalid or has expired." }, { status: 400 });
    }

    const outboxId = await prisma.$transaction(async (transaction) => {
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
      return enqueueEmail(buildPasswordChangedEmail(resetToken.email), transaction);
    });

    if (!outboxId) {
      return NextResponse.json({ success: false, message: "This reset link has already been used." }, { status: 409 });
    }

    if (getEmailProvider() !== "disabled") {
      await processEmailOutbox({ jobId: outboxId }).catch((mailError) => {
        console.error("Immediate password-changed email attempt failed:", mailError);
      });
    }
    return NextResponse.json({ success: true, message: "Your password has been updated. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ success: false, message: "We could not reset your password. Please try again." }, { status: 500 });
  }
}
