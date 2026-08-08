import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { googleCalendarAvailable } from "@/utils/connectorConfig";

export async function GET(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const connections = await prisma.calendarConnection.findMany({
    where: { userId: session.userId },
    select: {
      id: true,
      provider: true,
      accountEmail: true,
      status: true,
      lastSyncedAt: true,
      lastError: true,
      createdAt: true,
      externalCalendars: {
        select: { id: true, providerCalendarId: true, name: true, color: true, accessRole: true, selected: true, lastSyncedAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    success: true,
    connections,
    connectorAvailability: { googleCalendar: googleCalendarAvailable() },
  });
}

export async function PATCH(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const body = await req.json();
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
  const session = getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  const connection = await prisma.calendarConnection.findFirst({
    where: { id, userId: session.userId },
    include: { externalCalendars: { select: { calendarId: true } } },
  });
  if (!connection) return NextResponse.json({ success: false, message: "Connection not found." }, { status: 404 });
  await prisma.$transaction([
    prisma.calendarConnection.delete({ where: { id: connection.id } }),
    prisma.calendar.deleteMany({ where: { id: { in: connection.externalCalendars.map((calendar) => calendar.calendarId) }, userId: session.userId } }),
  ]);
  return NextResponse.json({ success: true, message: "Calendar connection and imported data removed." });
}
