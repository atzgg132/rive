import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { createAuthToken } from "@/utils/authTokens";
import { buildPasswordResetEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { isEmailVerificationSatisfied } from "@/utils/emailVerification";
import { evaluatePublicFormGate, PUBLIC_FORM_RATE_LIMITS } from "@/utils/publicFormGate";

const genericMessage = "If an account exists for that email, a secure reset link is on its way.";
const limits = PUBLIC_FORM_RATE_LIMITS.forgotPassword;

function accepted() {
  return NextResponse.json({ success: true, message: genericMessage });
}

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    // Durable, not process-local: this is public, unauthenticated, and sends
    // mail, so a counter that empties on every deploy is not a boundary. The
    // per-address cap that actually bounds how much mail one victim receives
    // is the `recentTokens` check below, which no header can influence.
    // Over-limit answers with the same generic success so a probe cannot tell
    // throttling from "no such account".
    if (!await durableRateLimit(`forgot-password:${hashRequestValue(ip)}`, limits.ip.limit, limits.ip.windowMs)) {
      return accepted();
    }

    const body = await req.json().catch(() => null);
    if (!evaluatePublicFormGate(body).ok) return accepted();

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ success: false, message: "Enter a valid email address." }, { status: 400 });
    }

    if (!await durableRateLimit(`forgot-password:email:${hashRequestValue(email)}`, limits.email.limit, limits.email.windowMs)) {
      return accepted();
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true, emailVerificationRequiredAt: true },
    });
    // Unverified signups are the bounce source: bots register a junk address,
    // then hit forgot-password to generate a second mail. Verified accounts,
    // and older accounts that never had verification required, still get a
    // reset link. The response stays generic either way.
    if (user && isEmailVerificationSatisfied(user)) {
      const recentTokens = await prisma.authToken.count({
        where: {
          email,
          type: "password_reset",
          createdAt: { gt: new Date(Date.now() - limits.email.windowMs) },
        },
      });
      if (recentTokens < limits.email.limit) {
        const { token } = await createAuthToken({ email, type: "password_reset", userId: user.id });
        const outboxId = await enqueueEmail(buildPasswordResetEmail(email, token));
        if (getEmailProvider() !== "disabled") await processEmailOutbox({ jobId: outboxId });
      }
    }

    return accepted();
  } catch (error) {
    console.error("Forgot password error:", error);
    return accepted();
  }
}
