import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { verifyPassword, generateUserToken, setSessionCookie, hashPassword, passwordNeedsUpgrade, isGooglePlaceholderPassword } from "@/utils/userAuth";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { sendLoginSuccessEmail } from "@/utils/email";
import { hashRequestValue } from "@/utils/contracts";
import { isEmailVerificationSatisfied } from "@/utils/emailVerification";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json().catch(() => ({}));
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || typeof password !== "string" || !password) {
      return NextResponse.json({ success: false, message: "Missing email or password." }, { status: 400 });
    }

    const ip = getRequestIp(req);
    if (!await durableRateLimit(`auth:login:${ip}`, 20, 15 * 60 * 1000)) {
      return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
    }
    if (!await durableRateLimit(`auth:login:email:${hashRequestValue(normalizedEmail)}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "Invalid email or password." }, { status: 401 });
    }

    const isPasswordCorrect = verifyPassword(password, user.passwordHash);

    if (!isPasswordCorrect) {
      if (user.googleSubject && isGooglePlaceholderPassword(user.passwordHash)) {
        return NextResponse.json({
          success: false,
          code: "GOOGLE_SIGN_IN",
          message: "This account uses Google. Continue with Google, or set a password from Forgot password.",
        }, { status: 401 });
      }
      return NextResponse.json({ success: false, message: "Invalid email or password." }, { status: 401 });
    }

    if (!isEmailVerificationSatisfied(user)) {
      return NextResponse.json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before signing in. You can request a fresh verification link from the registration page.",
      }, { status: 403 });
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
