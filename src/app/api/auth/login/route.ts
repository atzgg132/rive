import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { verifyPassword, generateUserToken, setSessionCookie, hashPassword, passwordNeedsUpgrade } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { sendLoginSuccessEmail } from "@/utils/email";

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    if (!rateLimit(`login:${ip}`, 20, 15 * 60 * 1000)) {
      return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
    }
    const { email, password } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || typeof password !== "string" || !password) {
      return NextResponse.json({ success: false, message: "Missing email or password." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "Invalid email or password." }, { status: 401 });
    }

    const isPasswordCorrect = verifyPassword(password, user.passwordHash);

    if (!isPasswordCorrect) {
      return NextResponse.json({ success: false, message: "Invalid email or password." }, { status: 401 });
    }

    if (passwordNeedsUpgrade(user.passwordHash)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(password) },
      });
    }

    await sendLoginSuccessEmail(user.email);

    const token = generateUserToken(user.id, user.email, user.plan, user.sessionVersion);

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      destination: user.onboardingStatus === "complete" || user.onboardingStatus === "skipped" ? "/dashboard" : "/onboarding",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan
      }
    });

    setSessionCookie(response, token);
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error: unknown) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Internal server error." }, { status: 500 });
  }
}
