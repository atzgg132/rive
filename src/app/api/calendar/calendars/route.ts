import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { ensureDefaultCalendar, isValidTimeZone } from "@/utils/calendar";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  await ensureDefaultCalendar(session.userId);
  const calendars = await prisma.calendar.findMany({
    where: { userId: session.userId },
    include: {
      externalCalendars: {
        select: { id: true, name: true, accessRole: true, selected: true, connection: { select: { provider: true, status: true } } },
      },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ success: true, calendars });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const color = typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : "#2563EB";
  const timeZone = typeof body.timeZone === "string" && isValidTimeZone(body.timeZone) ? body.timeZone : "UTC";
  if (!name) return NextResponse.json({ success: false, message: "Calendar name is required." }, { status: 400 });
  const calendar = await prisma.calendar.create({ data: { userId: session.userId, name, color, timeZone } });
  return NextResponse.json({ success: true, calendar }, { status: 201 });
}
