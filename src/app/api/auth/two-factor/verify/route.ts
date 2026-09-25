import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { generateUserToken, setSessionCookie } from "@/utils/userAuth";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { buildLoginSuccessEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { readJsonBody } from "@/utils/apiBoundary";
import {
  clearTwoFactorChallengeCookie,
  finalizeTwoFactorChallenge,
  getTwoFactorChallengeToken,
  peekTwoFactorChallenge,
} from "@/utils/twoFactorChallenge";
import { consumeTwoFactorCode } from "@/utils/twoFactorVerification";

// The login-time second factor. This is a public route by necessity (there is
// no session yet), so it is gated entirely by the short-lived pending
// challenge cookie plus durable, DB-backed rate limits — an in-memory limiter
// would reset on every deploy and this endpoint is exactly the kind of
// enumerable, credential-adjacent surface that must survive a restart.
export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    if (!await durableRateLimit(`2fa:verify:ip:${hashRequestValue(ip)}`, 30, 15 * 60 * 1000)) {
      return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
    }

    const challengeToken = getTwoFactorChallengeToken(req);
    const challenge = await peekTwoFactorChallenge(challengeToken);
    if (!challenge) {
      return NextResponse.json({
        success: false,
        code: "CHALLENGE_EXPIRED",
        message: "This sign-in has expired. Please sign in again.",
      }, { status: 400 });
    }

    // Lockout is keyed to the account, not the IP: an attacker who has the
    // password still can't grind codes for one victim from many addresses.
    if (!await durableRateLimit(`2fa:verify:user:${challenge.userId}`, 8, 15 * 60 * 1000)) {
      return NextResponse.json({ success: false, message: "Too many attempts. Please wait and try again." }, { status: 429 });
    }

    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const code = typeof parsedBody.body.code === "string" ? parsedBody.body.code.trim() : "";
    if (!code) {
      return NextResponse.json({ success: false, message: "Enter your authenticator or recovery code." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: {
        id: true,
        email: true,
        plan: true,
        sessionVersion: true,
        onboardingStatus: true,
        twoFactorSecretEncrypted: true,
        twoFactorEnabledAt: true,
        twoFactorLastUsedStep: true,
        loginAlertsEnabled: true,
      },
    });
    if (!user || !user.twoFactorEnabledAt || !user.twoFactorSecretEncrypted) {
      // 2FA was turned off mid-challenge (e.g. another session disabled it).
      // Fail closed rather than silently letting the challenge sign in.
      return NextResponse.json({ success: false, message: "Invalid code." }, { status: 401 });
    }

    const verified = await consumeTwoFactorCode(
      { id: user.id, twoFactorSecretEncrypted: user.twoFactorSecretEncrypted, twoFactorLastUsedStep: user.twoFactorLastUsedStep },
      code,
    );

    if (!verified) {
      return NextResponse.json({ success: false, message: "Invalid code." }, { status: 401 });
    }

    const finalized = await finalizeTwoFactorChallenge(challenge.id);
    if (!finalized) {
      return NextResponse.json({
        success: false,
        code: "CHALLENGE_EXPIRED",
        message: "This sign-in has expired. Please sign in again.",
      }, { status: 400 });
    }

    if (getEmailProvider() !== "disabled" && user.loginAlertsEnabled) {
      const outboxId = await enqueueEmail(buildLoginSuccessEmail(user.email)).catch(() => null);
      if (outboxId) {
        await processEmailOutbox({ jobId: outboxId }).catch((mailError) => {
          console.error("Immediate sign-in notice attempt failed:", mailError);
        });
      }
    }

    const token = generateUserToken(user.id, user.email, user.plan, user.sessionVersion);
    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      destination: user.onboardingStatus === "complete" || user.onboardingStatus === "skipped" ? "/dashboard" : "/onboarding",
    });
    setSessionCookie(response, token);
    clearTwoFactorChallengeCookie(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Two-factor login verification error:", error);
    return NextResponse.json({ success: false, message: "We could not verify that code. Please try again." }, { status: 500 });
  }
}
