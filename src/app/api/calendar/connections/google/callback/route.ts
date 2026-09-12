import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { verifyCalendarOAuthState } from "@/utils/calendarCrypto";
import { discoverGoogleCalendars, exchangeGoogleCode, saveGoogleConnection, syncGoogleConnection, watchGoogleCalendar } from "@/utils/googleCalendar";
import { prisma } from "@/utils/db";
import { googleCalendarAvailable } from "@/utils/connectorConfig";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  const code = req.nextUrl.searchParams.get("code");
  const providerError = req.nextUrl.searchParams.get("error");
  const state = verifyCalendarOAuthState(req.nextUrl.searchParams.get("state") || "");
  if (!session || !state || state.userId !== session.userId) {
    return NextResponse.redirect(new URL("/calendar?connectionError=invalid_google_callback", process.env.APP_URL || req.url));
  }
  if (providerError) {
    // Google refused or the user declined consent — nothing was exchanged or
    // stored, so this is a benign cancellation, not a sync failure.
    return NextResponse.redirect(new URL(`${state.returnTo}?connectionError=google_access_denied`, process.env.APP_URL || req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/calendar?connectionError=invalid_google_callback", process.env.APP_URL || req.url));
  }
  if (!googleCalendarAvailable()) {
    return NextResponse.redirect(new URL(`${state.returnTo}?connectionError=google_not_available`, process.env.APP_URL || req.url));
  }
  let connectionId: string | null = null;
  try {
    const credentials = await exchangeGoogleCode(code);
    const connection = await saveGoogleConnection(session.userId, credentials);
    connectionId = connection.id;
    const calendars = await discoverGoogleCalendars(connection.id);
    await syncGoogleConnection(connection.id);
    for (const external of calendars.filter((calendar) => calendar.selected)) {
      await watchGoogleCalendar(external.id).catch((error) => console.error("Google watch setup failed:", error));
    }
    return NextResponse.redirect(new URL(`${state.returnTo}?connected=google`, process.env.APP_URL || req.url));
  } catch (error) {
    console.error("Google calendar callback failed:", error);
    // Attribute the failure only when the account is identifiable — either the
    // connection was (re)saved this attempt, or the user has exactly one Google
    // connection. With several accounts, findFirst could flag a healthy one.
    const targetId = connectionId || (await prisma.calendarConnection.findMany({
      where: { userId: session.userId, provider: "google" },
      select: { id: true },
    }).then((rows) => (rows.length === 1 ? rows[0].id : null)));
    if (targetId) {
      await prisma.calendarConnection.update({
        where: { id: targetId },
        data: { status: "error", lastError: error instanceof Error ? error.message.slice(0, 500) : "Connection failed" },
      });
    }
    return NextResponse.redirect(new URL(`${state.returnTo}?connectionError=google_sync_failed`, process.env.APP_URL || req.url));
  }
}
