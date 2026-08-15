import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { generateUserToken, setSessionCookie } from "@/utils/userAuth";
import { recordProductEvent, PRODUCT_EVENTS } from "@/utils/productEvents";
import { recordActivationEvent, ACTIVATION_EVENTS } from "@/utils/activation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token || token.length > 256) {
      return NextResponse.json({ success: false, code: "INVALID_TOKEN", message: "This verification link is invalid or incomplete." }, { status: 400 });
    }

    const now = new Date();
    const authToken = await prisma.authToken.findFirst({
      where: { tokenHash: (await import("@/utils/authTokens")).hashAuthToken(token), type: "email_verification", usedAt: null },
      select: { id: true, userId: true, email: true, expiresAt: true },
    });
    if (!authToken) {
      return NextResponse.json({ success: false, code: "INVALID_TOKEN", message: "This verification link is invalid or has already been used." }, { status: 400 });
    }
    if (authToken.expiresAt <= now) {
      return NextResponse.json({ success: false, code: "EXPIRED_TOKEN", message: "This verification link has expired. Request a new one to continue." }, { status: 410 });
    }
    if (!authToken.userId) {
      return NextResponse.json({ success: false, code: "INVALID_TOKEN", message: "This verification link is not associated with an account." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const consumed = await tx.authToken.updateMany({
        where: { id: authToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return null;
      return tx.user.update({
        where: { id: authToken.userId! },
        data: { emailVerifiedAt: now },
        select: { id: true, email: true, name: true, plan: true, sessionVersion: true, onboardingStatus: true },
      });
    });
    if (!result) {
      return NextResponse.json({ success: false, code: "INVALID_TOKEN", message: "This verification link is invalid or has already been used." }, { status: 400 });
    }

    await recordProductEvent({
      userId: result.id,
      eventName: PRODUCT_EVENTS.emailVerified,
      module: "auth",
      dedupeKey: `email_verified:${result.id}`,
    });
    await recordActivationEvent(result.id, ACTIVATION_EVENTS.registered, { verified: true });

    const response = NextResponse.json({
      success: true,
      message: "Email verified. Your workspace is ready.",
      destination: result.onboardingStatus === "complete" || result.onboardingStatus === "skipped" ? "/dashboard" : "/onboarding",
      user: { id: result.id, email: result.email, name: result.name, plan: result.plan },
    });
    setSessionCookie(response, generateUserToken(result.id, result.email, result.plan, result.sessionVersion));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json({ success: false, message: "Unable to verify this email right now. Please request a new link." }, { status: 500 });
  }
}

