import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { createCalendarOAuthState } from "@/utils/calendarCrypto";
import { googleAuthorizationUrl } from "@/utils/googleCalendar";
import { googleCalendarAvailable } from "@/utils/connectorConfig";
import { prisma } from "@/utils/db";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.redirect(new URL("/login?next=/calendar", process.env.APP_URL || req.url));
  if (!googleCalendarAvailable()) return NextResponse.redirect(new URL("/calendar?connectionError=google_not_available", process.env.APP_URL || req.url));
  try {
    const returnTo = req.nextUrl.searchParams.get("from") === "onboarding" ? "/onboarding" : "/calendar";
    // On reconnect, hint the previously connected account so the chooser lands
    // on it — multi-account browsers otherwise default to the wrong identity.
    const existing = await prisma.calendarConnection.findFirst({
      where: { userId: session.userId, provider: "google" },
      orderBy: { updatedAt: "desc" },
      select: { accountEmail: true },
    });
    return NextResponse.redirect(googleAuthorizationUrl(createCalendarOAuthState(session.userId, returnTo), existing?.accountEmail || undefined));
  } catch (error) {
    console.error("Google calendar connection error:", error);
    return NextResponse.redirect(new URL("/calendar?connectionError=google_not_configured", process.env.APP_URL || req.url));
  }
}
