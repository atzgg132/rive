import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { createAuthToken } from "@/utils/authTokens";
import { sendPasswordResetEmail } from "@/utils/email";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";

const genericMessage = "If an account exists for that email, a secure reset link is on its way.";

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    if (!rateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000)) {
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
        await sendPasswordResetEmail(email, token);
      }
    }

    return NextResponse.json({ success: true, message: genericMessage });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ success: true, message: genericMessage });
  }
}
