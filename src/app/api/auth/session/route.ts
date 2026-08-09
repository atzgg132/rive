import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "No active session found." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        avatarUrl: true,
        onboardingStatus: true,
        onboardingStep: true,
        businessType: true,
        businessTypes: true,
        profession: true,
        currency: true,
        displayCurrency: true,
        timeZone: true,
        createdAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }

    // Format fields for frontend compatibility
    const formattedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      avatar_url: user.avatarUrl,
      onboarding_status: user.onboardingStatus,
      onboarding_step: user.onboardingStep,
      business_type: user.businessType,
      business_types: user.businessTypes,
      profession: user.profession,
      currency: user.currency,
      display_currency: user.displayCurrency,
      time_zone: user.timeZone,
      created_at: user.createdAt
    };

    const response = NextResponse.json({
      success: true,
      user: formattedUser
    });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error: unknown) {
    console.error("Session fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
