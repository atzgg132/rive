import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { ensureDefaultCalendar, getCalendarEvents, isDateOnly, isValidTimeZone } from "@/utils/calendar";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { pushEventToGoogle } from "@/utils/googleCalendar";
import { googleCalendarAvailable } from "@/utils/connectorConfig";

async function syncCalendarMutation(userId: string, eventId: string, operation: "create" | "update" | "delete") {
  if (!googleCalendarAvailable()) return false;
  const job = await prisma.calendarSyncOutbox.create({
    data: { userId, eventId, operation, provider: "google" },
  });
  try {
    const synced = await pushEventToGoogle(eventId, operation);
    await prisma.calendarSyncOutbox.update({
      where: { id: job.id },
      data: { status: "completed", attempts: 1, processedAt: new Date() },
    });
    return synced;
  } catch (error) {
    await prisma.calendarSyncOutbox.update({
      where: { id: job.id },
      data: {
        attempts: 1,
        availableAt: new Date(Date.now() + 60_000),
        lastError: error instanceof Error ? error.message.slice(0, 500) : "Synchronization failed",
      },
    });
    return false;
  }
}

function parseRange(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const start = new Date(params.get("start") || "");
  const end = new Date(params.get("end") || "");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  if (end.getTime() - start.getTime() > 370 * 24 * 60 * 60 * 1000) return null;
  return { start, end };
}

function parseEventInput(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const allDay = body.allDay === true;
  const timeZone = typeof body.timeZone === "string" && isValidTimeZone(body.timeZone) ? body.timeZone : "UTC";
  if (!title) return { error: "Event title is required." } as const;

  if (allDay) {
    const startDate = typeof body.startDate === "string" ? body.startDate : "";
    const endDate = typeof body.endDate === "string" ? body.endDate : "";
    if (!isDateOnly(startDate) || !isDateOnly(endDate) || endDate <= startDate) {
      return { error: "All-day events require valid start and exclusive end dates." } as const;
    }
    return { data: { title, allDay, timeZone, startDate, endDate, startAt: null, endAt: null } } as const;
  }

  const startAt = new Date(typeof body.startAt === "string" ? body.startAt : "");
  const endAt = new Date(typeof body.endAt === "string" ? body.endAt : "");
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    return { error: "Timed events require a valid start and end." } as const;
  }
  return { data: { title, allDay, timeZone, startAt, endAt, startDate: null, endDate: null } } as const;
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const range = parseRange(req);
  if (!range) return NextResponse.json({ success: false, message: "A valid date range of at most one year is required." }, { status: 400 });
  const events = await getCalendarEvents(session.userId, range.start, range.end);
  return NextResponse.json({ success: true, events });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`calendar-create:${session.userId}:${getRequestIp(req)}`, 120, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many calendar changes. Please try again shortly." }, { status: 429 });
  }
  const body = (await req.json()) as Record<string, unknown>;
  const parsed = parseEventInput(body);
  if ("error" in parsed) return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });
  const fallback = await ensureDefaultCalendar(session.userId, parsed.data.timeZone);
  const calendarId = typeof body.calendarId === "string" ? body.calendarId : fallback.id;
  const calendar = await prisma.calendar.findFirst({ where: { id: calendarId, userId: session.userId } });
  if (!calendar) return NextResponse.json({ success: false, message: "Calendar not found." }, { status: 404 });
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() || null : null;
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() || null : null;
  const [client, project] = await Promise.all([
    clientId ? prisma.client.findFirst({ where: { id: clientId, userId: session.userId }, select: { id: true } }) : null,
    projectId ? prisma.project.findFirst({ where: { id: projectId, userId: session.userId }, select: { id: true } }) : null,
  ]);
  if (clientId && !client) return NextResponse.json({ success: false, message: "Client not found or unauthorized." }, { status: 404 });
  if (projectId && !project) return NextResponse.json({ success: false, message: "Project not found or unauthorized." }, { status: 404 });

  const event = await prisma.calendarEvent.create({
    data: {
      ...parsed.data,
      userId: session.userId,
      calendarId,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      location: typeof body.location === "string" ? body.location.trim() || null : null,
      meetingUrl: typeof body.meetingUrl === "string" ? body.meetingUrl.trim() || null : null,
      availability: body.availability === "free" ? "free" : "busy",
      clientId: client?.id || null,
      projectId: project?.id || null,
      source: "native",
    },
  });
  const synced = await syncCalendarMutation(session.userId, event.id, "create");
  return NextResponse.json({ success: true, event, synced }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const body = (await req.json()) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const existing = await prisma.calendarEvent.findFirst({ where: { id, userId: session.userId, deletedAt: null } });
  if (!existing) return NextResponse.json({ success: false, message: "Event not found." }, { status: 404 });
  if (existing.source === "external_readonly") return NextResponse.json({ success: false, message: "This event is read-only." }, { status: 403 });
  const parsed = parseEventInput(body);
  if ("error" in parsed) return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });
  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      ...parsed.data,
      description: typeof body.description === "string" ? body.description.trim() || null : existing.description,
      location: typeof body.location === "string" ? body.location.trim() || null : existing.location,
      availability: body.availability === "free" ? "free" : "busy",
      sourceRevision: { increment: 1 },
    },
  });
  const synced = await syncCalendarMutation(session.userId, event.id, "update");
  return NextResponse.json({ success: true, event, synced });
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  const existing = await prisma.calendarEvent.findFirst({ where: { id, userId: session.userId, deletedAt: null } });
  if (!existing) return NextResponse.json({ success: false, message: "Event not found." }, { status: 404 });
  if (existing.source === "external_readonly") return NextResponse.json({ success: false, message: "This event is read-only." }, { status: 403 });
  await prisma.calendarEvent.update({ where: { id }, data: { deletedAt: new Date(), status: "cancelled", sourceRevision: { increment: 1 } } });
  const synced = await syncCalendarMutation(session.userId, id, "delete");
  return NextResponse.json({ success: true, synced, message: "Event moved to recovery." });
}
