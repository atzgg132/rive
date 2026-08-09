import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { createCalendarOAuthState } from "@/utils/calendarCrypto";
import { googleAuthorizationUrl } from "@/utils/googleCalendar";
import { googleCalendarAvailable } from "@/utils/connectorConfig";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.redirect(new URL("/login?next=/calendar", req.url));
  if (!googleCalendarAvailable()) return NextResponse.redirect(new URL("/calendar?connectionError=google_not_available", req.url));
  try {
    const returnTo = req.nextUrl.searchParams.get("from") === "onboarding" ? "/onboarding" : "/calendar";
    return NextResponse.redirect(googleAuthorizationUrl(createCalendarOAuthState(session.userId, returnTo)));
  } catch (error) {
    console.error("Google calendar connection error:", error);
    return NextResponse.redirect(new URL("/calendar?connectionError=google_not_configured", req.url));
  }
}
