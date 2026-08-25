import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { createAuthToken } from "@/utils/authTokens";
import { buildPasswordResetEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { hashRequestValue } from "@/utils/contracts";

const genericMessage = "If an account exists for that email, a secure reset link is on its way.";

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    // Durable, not process-local: this is public, unauthenticated, and sends
    // mail, so a counter that empties on every deploy is not a boundary. The
    // per-address cap that actually bounds how much mail one victim receives
    // is the `recentTokens` check below, which no header can influence.
    if (!await durableRateLimit(`forgot-password:${hashRequestValue(ip)}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json({ success: true, message: genericMessage });
    }

    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ success: false, message: "Enter a valid email address." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const recentTokens = await prisma.authToken.count({
        where: {
          email,
          type: "password_reset",
          createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
        },
      });
      if (recentTokens < 3) {
        const { token } = await createAuthToken({ email, type: "password_reset", userId: user.id });
        const outboxId = await enqueueEmail(buildPasswordResetEmail(email, token));
        if (getEmailProvider() !== "disabled") await processEmailOutbox({ jobId: outboxId });
      }
    }

    return NextResponse.json({ success: true, message: genericMessage });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ success: true, message: genericMessage });
  }
}
