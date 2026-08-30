import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { generateUserToken, GOOGLE_PLACEHOLDER_PASSWORD, setSessionCookie } from "@/utils/userAuth";
import { googleLoginAvailable } from "@/utils/connectorConfig";
import { exchangeGoogleLoginCode, getGoogleLoginProfile, verifyGoogleLoginState } from "@/utils/googleAuth";
import { decideGoogleLogin } from "@/utils/googleLogin";
import { sendLoginSuccessEmail } from "@/utils/email";
import { attributionFromRequest, saveUserAttribution } from "@/utils/attribution";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";

function loginError(req: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/login?google_error=${code}`, process.env.APP_URL || req.url));
}

function loginDestination(onboardingStatus: string, nextPath: string) {
  if (nextPath === "/migrate") return "/migrate";
  if (onboardingStatus === "complete" || onboardingStatus === "skipped") {
    return nextPath || "/dashboard";
  }
  return "/onboarding";
}

export async function GET(req: NextRequest) {
  try {
    if (!googleLoginAvailable()) return loginError(req, "not_configured");
    const denied = req.nextUrl.searchParams.get("error");
    if (denied === "access_denied") return loginError(req, "access_denied");

    const ip = getRequestIp(req);
    if (!await durableRateLimit(`auth:google:callback:${ip}`, 30, 15 * 60 * 1000)) {
      return loginError(req, "invalid_callback");
    }

    const code = req.nextUrl.searchParams.get("code");
    const state = verifyGoogleLoginState(req.nextUrl.searchParams.get("state") || "");
    if (!code || !state) return loginError(req, "invalid_callback");

    const credentials = await exchangeGoogleLoginCode(code);
    const profile = await getGoogleLoginProfile(credentials.accessToken);
    const [bySubject, byEmail] = await Promise.all([
      prisma.user.findUnique({
        where: { googleSubject: profile.sub },
        select: { id: true, email: true, googleSubject: true },
      }),
      prisma.user.findUnique({
        where: { email: profile.email },
        select: { id: true, email: true, googleSubject: true },
      }),
    ]);
    const decision = decideGoogleLogin(profile, bySubject, byEmail);
    if (decision.action === "reject") return loginError(req, decision.reason);

    let user: {
      id: string;
      email: string;
      plan: string;
      sessionVersion: number;
      onboardingStatus: string;
    };

    if (decision.action === "create") {
      const { anonymousId, attribution: rawAttribution } = attributionFromRequest(req);
      const attribution = {
        source: rawAttribution.source || "google",
        medium: rawAttribution.medium || "oauth",
        campaign: rawAttribution.campaign,
        referrer: rawAttribution.referrer,
        landingPage: rawAttribution.landingPage || "/login",
        firstSource: rawAttribution.firstSource || rawAttribution.source || "google",
        firstMedium: rawAttribution.firstMedium || rawAttribution.medium || "oauth",
        firstCampaign: rawAttribution.firstCampaign || rawAttribution.campaign,
        firstReferrer: rawAttribution.firstReferrer || rawAttribution.referrer,
        firstLandingPage: rawAttribution.firstLandingPage || rawAttribution.landingPage || "/login",
        lastSource: rawAttribution.lastSource || rawAttribution.source || "google",
        lastMedium: rawAttribution.lastMedium || rawAttribution.medium || "oauth",
        lastCampaign: rawAttribution.lastCampaign || rawAttribution.campaign,
        lastReferrer: rawAttribution.lastReferrer || rawAttribution.referrer,
        lastLandingPage: rawAttribution.lastLandingPage || rawAttribution.landingPage || "/login",
        referralSource: rawAttribution.referralSource,
      };
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: profile.email,
            name: profile.name || null,
            passwordHash: GOOGLE_PLACEHOLDER_PASSWORD,
            googleSubject: profile.sub,
            plan: "free",
            accountType: "customer",
            emailVerifiedAt: new Date(),
            onboardingStatus: "new",
            onboardingStep: 0,
            timeZone: "UTC",
            currency: "USD",
            onboardingData: state.next === "/migrate" ? { goal: "migrate", startingPath: "import" } : undefined,
          },
          select: { id: true, email: true, plan: true, sessionVersion: true, onboardingStatus: true },
        });
        await saveUserAttribution(created.id, attribution, tx);
        await recordProductEvent({
          userId: created.id,
          anonymousId,
          eventName: PRODUCT_EVENTS.signupCompleted,
          module: "auth",
          dedupeKey: `signup_completed:${created.id}`,
          properties: { accountType: "customer", method: "google" },
        }, tx);
        return created;
      });
      await recordActivationEvent(user.id, ACTIVATION_EVENTS.registered);
    } else if (decision.action === "link") {
      user = await prisma.user.update({
        where: { id: decision.userId },
        data: {
          googleSubject: profile.sub,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, email: true, plan: true, sessionVersion: true, onboardingStatus: true },
      });
      await sendLoginSuccessEmail(user.email);
    } else {
      user = await prisma.user.findUniqueOrThrow({
        where: { id: decision.userId },
        select: { id: true, email: true, plan: true, sessionVersion: true, onboardingStatus: true },
      });
      await sendLoginSuccessEmail(user.email);
    }

    const destination = loginDestination(user.onboardingStatus, state.next);
    const response = NextResponse.redirect(new URL(destination, process.env.APP_URL || req.url));
    setSessionCookie(response, generateUserToken(user.id, user.email, user.plan, user.sessionVersion));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return loginError(req, "account_conflict");
    }
    console.error("Google sign-in callback failed:", error);
    return loginError(req, "invalid_callback");
  }
}
