import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { googleCalendarAvailable } from "@/utils/connectorConfig";
import { revokeGoogleCredentials } from "@/utils/googleCalendar";
import { readJsonBody } from "@/utils/apiBoundary";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const [connections, pendingSync, failedSync] = await Promise.all([
    prisma.calendarConnection.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        provider: true,
        accountEmail: true,
        status: true,
        defaultExternalCalendarId: true,
        lastSyncedAt: true,
        lastError: true,
        createdAt: true,
        externalCalendars: {
          select: { id: true, providerCalendarId: true, name: true, color: true, accessRole: true, selected: true, lastSyncedAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.calendarSyncOutbox.count({ where: { userId: session.userId, provider: "google", status: "pending" } }),
    prisma.calendarSyncOutbox.count({ where: { userId: session.userId, provider: "google", status: "failed" } }),
  ]);
  return NextResponse.json({
    success: true,
    connections,
    outbox: { pending: pendingSync, failed: failedSync },
    connectorAvailability: { googleCalendar: googleCalendarAvailable() },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
  const externalCalendarId = typeof body.externalCalendarId === "string" ? body.externalCalendarId : "";
  const external = await prisma.externalCalendar.findFirst({
    where: { id: externalCalendarId, connection: { userId: session.userId } },
  });
  if (!external) return NextResponse.json({ success: false, message: "Connected calendar not found." }, { status: 404 });
  await prisma.$transaction([
    prisma.externalCalendar.update({ where: { id: external.id }, data: { selected: body.selected === true } }),
    prisma.calendar.update({ where: { id: external.calendarId }, data: { isVisible: body.selected === true } }),
  ]);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  const connection = await prisma.calendarConnection.findFirst({
    where: { id, userId: session.userId },
    include: { externalCalendars: { select: { calendarId: true } } },
  });
  if (!connection) return NextResponse.json({ success: false, message: "Connection not found." }, { status: 404 });
  // Revoke before deleting the local row: if this failed silently after
  // deletion, there would be no record left to retry the revoke against.
  if (connection.provider === "google") {
    await revokeGoogleCredentials(connection.encryptedCredentials);
  }
  await prisma.$transaction([
    prisma.calendarConnection.delete({ where: { id: connection.id } }),
    prisma.calendar.deleteMany({ where: { id: { in: connection.externalCalendars.map((calendar) => calendar.calendarId) }, userId: session.userId } }),
  ]);
  // Same audit trail the generic connector disconnect writes — support needs
  // to see that the user deliberately disconnected, not that sync broke.
  // AuditEvent has @@unique([userId, action]): a second disconnect would throw
  // after the delete already succeeded, so a collision must not fail the call.
  await prisma.auditEvent.create({
    data: { userId: session.userId, action: "connector.disconnected", targetType: "calendar_connection", targetId: id },
  }).catch((error) => console.warn("Calendar disconnect audit failed:", error));
  return NextResponse.json({ success: true, message: "Calendar connection and imported data removed." });
}
