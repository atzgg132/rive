import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { discoverGoogleCalendars, syncGoogleConnection } from "@/utils/googleCalendar";
import { googleCalendarAvailable } from "@/utils/connectorConfig";

export async function POST(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!googleCalendarAvailable()) return NextResponse.json({ success: false, message: "Google Calendar is not available." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const connection = await prisma.calendarConnection.findFirst({
    where: {
      id: typeof body.connectionId === "string" ? body.connectionId : undefined,
      userId: session.userId,
      provider: "google",
    },
  });
  if (!connection) return NextResponse.json({ success: false, message: "Google Calendar is not connected." }, { status: 404 });
  try {
    await discoverGoogleCalendars(connection.id);
    await syncGoogleConnection(connection.id);
    return NextResponse.json({ success: true, syncedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Synchronization failed.";
    await prisma.calendarConnection.update({ where: { id: connection.id }, data: { status: "error", lastError: message } });
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
