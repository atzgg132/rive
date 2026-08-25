import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { hashPassword } from "@/utils/userAuth";
import { findValidAuthToken, prepareAuthToken } from "@/utils/authTokens";
import { buildEmailVerificationEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { getRequestIp } from "@/utils/rateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { attributionFromRequest, saveUserAttribution } from "@/utils/attribution";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";
import { evaluatePublicFormGate, PUBLIC_FORM_RATE_LIMITS } from "@/utils/publicFormGate";

function validEmail(value: unknown): value is string {
  return typeof value === "string" && /^\S+@\S+\.\S+$/.test(value.trim());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 160) : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken.trim() : "";

    // Keep automated form posts from consuming database work. Honeypot hits
    // and instant POSTs get the same 201 a real signup would, so the filler
    // is not told which check caught it.
    if (!evaluatePublicFormGate(body).ok) {
      return NextResponse.json({ success: true, requiresEmailVerification: true, message: "Account created. Check your email to verify your address before entering Rive." }, { status: 201 });
    }

    if (!validEmail(email) || password.length < 8 || !name) {
      return NextResponse.json({ success: false, message: "Enter your name, a valid email, and a password of at least 8 characters." }, { status: 400 });
    }

    const ip = getRequestIp(req);
    const limits = PUBLIC_FORM_RATE_LIMITS.register;
    const allowed = await durableRateLimit(`auth:register:${hashRequestValue(ip)}`, limits.ip.limit, limits.ip.windowMs);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }
    if (!await durableRateLimit(`auth:register:email:${hashRequestValue(email)}`, limits.email.limit, limits.email.windowMs)) {
      return NextResponse.json({ success: false, message: "Too many signup attempts for this address. Please try again later." }, { status: 429 });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true, emailVerificationRequiredAt: true },
    });
    if (existing) {
      return NextResponse.json({
        success: false,
        code: existing.emailVerificationRequiredAt && !existing.emailVerifiedAt ? "EMAIL_NOT_VERIFIED" : "EMAIL_ALREADY_REGISTERED",
        message: existing.emailVerificationRequiredAt && !existing.emailVerifiedAt
          ? "This email already has an account waiting for verification. Check your inbox or request a new verification email."
          : "Email is already registered. Try logging in instead.",
      }, { status: 409 });
    }

    // Old invitation links remain useful as referral context, but are no longer
    // an access gate. A malformed or expired legacy token must not block open signup.
    const legacyInvitation = inviteToken ? await findValidAuthToken(inviteToken, "waitlist_invite") : null;
    const { anonymousId, attribution: rawAttribution } = attributionFromRequest(req);
    // Direct traffic is still a captured acquisition source. This fallback is
    // important for API clients and browsers that arrive without the tracker
    // cookie, so qualified-user reporting does not silently lose signups.
    const attribution = {
      source: rawAttribution.source || "direct",
      medium: rawAttribution.medium || "none",
      campaign: rawAttribution.campaign,
      referrer: rawAttribution.referrer,
      landingPage: rawAttribution.landingPage || "/register",
      firstSource: rawAttribution.firstSource || rawAttribution.source || "direct",
      firstMedium: rawAttribution.firstMedium || rawAttribution.medium || "none",
      firstCampaign: rawAttribution.firstCampaign || rawAttribution.campaign,
      firstReferrer: rawAttribution.firstReferrer || rawAttribution.referrer,
      firstLandingPage: rawAttribution.firstLandingPage || rawAttribution.landingPage || "/register",
      lastSource: rawAttribution.lastSource || rawAttribution.source || "direct",
      lastMedium: rawAttribution.lastMedium || rawAttribution.medium || "none",
      lastCampaign: rawAttribution.lastCampaign || rawAttribution.campaign,
      lastReferrer: rawAttribution.lastReferrer || rawAttribution.referrer,
      lastLandingPage: rawAttribution.lastLandingPage || rawAttribution.landingPage || "/register",
      referralSource: rawAttribution.referralSource,
    };
    const referralSource = legacyInvitation?.email === email ? "legacy_waitlist_invite" : attribution.referralSource;
    const passwordHash = hashPassword(password);
    const requiredAt = new Date();
    const preparedVerification = prepareAuthToken({ email, type: "email_verification" });
    const verificationEmail = buildEmailVerificationEmail(email, name, preparedVerification.token);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          plan: "free",
          accountType: "customer",
          emailVerificationRequiredAt: requiredAt,
          onboardingStatus: "new",
          onboardingStep: 0,
          timeZone: "UTC",
          currency: "USD",
        },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          emailVerifiedAt: true,
          emailVerificationRequiredAt: true,
        },
      });

      await tx.authToken.updateMany({
        where: { email, type: "email_verification", usedAt: null },
        data: { usedAt: requiredAt },
      });
      await tx.authToken.create({
        data: { ...preparedVerification.data, userId: created.id },
      });
      await enqueueEmail(verificationEmail, tx);
      await saveUserAttribution(created.id, { ...attribution, referralSource }, tx);
      await recordProductEvent({
        userId: created.id,
        anonymousId,
        eventName: PRODUCT_EVENTS.signupCompleted,
        module: "auth",
        dedupeKey: `signup_completed:${created.id}`,
        properties: { accountType: "customer" },
      }, tx);
      await recordProductEvent({
        userId: created.id,
        anonymousId,
        eventName: PRODUCT_EVENTS.emailVerificationSent,
        module: "auth",
        dedupeKey: `email_verification_sent:${created.id}`,
        properties: { delivery: "outbox" },
      }, tx);

      if (legacyInvitation?.email === email) {
        await tx.authToken.updateMany({
          where: { id: legacyInvitation.id, usedAt: null },
          data: { usedAt: requiredAt },
        });
      }
      return created;
    });

    await recordActivationEvent(user.id, ACTIVATION_EVENTS.registered);

    // Verification is launch-critical. Process one queued message immediately
    // so signup does not depend on an optional cron schedule. The outbox still
    // retries transient delivery failures asynchronously.
    if (getEmailProvider() !== "disabled") {
      await processEmailOutbox(1);
    }

    return NextResponse.json({
      success: true,
      requiresEmailVerification: true,
      message: "Account created. Check your email to verify your address before entering Rive.",
      user,
    }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: false, message: "Email is already registered. Try logging in instead." }, { status: 409 });
    }
    console.error("Registration error:", error);
    return NextResponse.json({ success: false, message: "Unable to create your account right now. Please try again." }, { status: 500 });
  }
}
