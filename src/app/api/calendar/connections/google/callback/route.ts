import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { verifyCalendarOAuthState } from "@/utils/calendarCrypto";
import { discoverGoogleCalendars, exchangeGoogleCode, saveGoogleConnection, syncGoogleConnection, watchGoogleCalendar } from "@/utils/googleCalendar";
import { prisma } from "@/utils/db";
import { googleCalendarAvailable } from "@/utils/connectorConfig";

export async function GET(req: NextRequest) {
  const session = getSessionUser(req);
  const code = req.nextUrl.searchParams.get("code");
  const state = verifyCalendarOAuthState(req.nextUrl.searchParams.get("state") || "");
  if (!session || !state || state.userId !== session.userId || !code) {
    return NextResponse.redirect(new URL("/calendar?connectionError=invalid_google_callback", req.url));
  }
  if (!googleCalendarAvailable()) {
    return NextResponse.redirect(new URL(`${state.returnTo}?connectionError=google_not_available`, req.url));
  }
  try {
    const credentials = await exchangeGoogleCode(code);
    const connection = await saveGoogleConnection(session.userId, credentials);
    const calendars = await discoverGoogleCalendars(connection.id);
    await syncGoogleConnection(connection.id);
    for (const external of calendars.filter((calendar) => calendar.selected)) {
      await watchGoogleCalendar(external.id).catch((error) => console.error("Google watch setup failed:", error));
    }
    return NextResponse.redirect(new URL(`${state.returnTo}?connected=google`, req.url));
  } catch (error) {
    console.error("Google calendar callback failed:", error);
    const existing = await prisma.calendarConnection.findFirst({
      where: { userId: session.userId, provider: "google" },
    });
    if (existing) {
      await prisma.calendarConnection.update({
        where: { id: existing.id },
        data: { status: "error", lastError: error instanceof Error ? error.message.slice(0, 500) : "Connection failed" },
      });
    }
    return NextResponse.redirect(new URL(`${state.returnTo}?connectionError=google_sync_failed`, req.url));
  }
}
