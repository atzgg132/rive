import crypto from "crypto";
import { prisma } from "@/utils/db";

export type CalendarEventDto = {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  meetingUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  startDate: string | null;
  endDate: string | null;
  allDay: boolean;
  timeZone: string;
  availability: string;
  status: string;
  source: string;
  color: string;
  clientId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  taskId: string | null;
  invoiceId: string | null;
  linkBehavior: string | null;
  readOnly: boolean;
};

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function ensureDefaultCalendar(userId: string, timeZone = "UTC") {
  const existingDefaults = await prisma.calendar.findMany({
    where: { userId, isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  if (existingDefaults.length) {
    const [primary, ...duplicates] = existingDefaults;
    if (duplicates.length) {
      const duplicateIds = duplicates.map((calendar) => calendar.id);
      await prisma.$transaction([
        prisma.calendarEvent.updateMany({
          where: { calendarId: { in: duplicateIds } },
          data: { calendarId: primary.id },
        }),
        prisma.calendar.deleteMany({
          where: { id: { in: duplicateIds }, externalCalendars: { none: {} } },
        }),
      ]);
    }
    return primary;
  }

  return prisma.$transaction(async (transaction) => {
    const fallback = await transaction.calendar.findFirst({ where: { userId } });
    if (fallback) {
      return transaction.calendar.update({
        where: { id: fallback.id },
        data: { isDefault: true },
      });
    }
    return transaction.calendar.upsert({
      where: { id: `default-${userId}` },
      create: {
        id: `default-${userId}`,
        userId,
        name: "My calendar",
        color: "#2563EB",
        timeZone: isValidTimeZone(timeZone) ? timeZone : "UTC",
        isDefault: true,
      },
      update: { isDefault: true },
    });
  });
}

function nativeEventDto(event: {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  meetingUrl: string | null;
  startAt: Date | null;
  endAt: Date | null;
  startDate: string | null;
  endDate: string | null;
  allDay: boolean;
  timeZone: string;
  availability: string;
  status: string;
  source: string;
  clientId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  taskId: string | null;
  invoiceId: string | null;
  linkBehavior: string | null;
  calendar: { color: string };
}): CalendarEventDto {
  return {
    id: event.id,
    calendarId: event.calendarId,
    title: event.title,
    description: event.description,
    location: event.location,
    meetingUrl: event.meetingUrl,
    startAt: event.startAt?.toISOString() || null,
    endAt: event.endAt?.toISOString() || null,
    startDate: event.startDate,
    endDate: event.endDate,
    allDay: event.allDay,
    timeZone: event.timeZone,
    availability: event.availability,
    status: event.status,
    source: event.source,
    color: event.calendar.color,
    clientId: event.clientId,
    projectId: event.projectId,
    milestoneId: event.milestoneId,
    taskId: event.taskId,
    invoiceId: event.invoiceId,
    linkBehavior: event.linkBehavior,
    readOnly: event.source === "external_readonly",
  };
}

export async function getCalendarEvents(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEventDto[]> {
  const defaultCalendar = await ensureDefaultCalendar(userId);
  const dateStart = rangeStart.toISOString().slice(0, 10);
  const dateEnd = rangeEnd.toISOString().slice(0, 10);

  const [nativeEvents, projects, milestones, invoices, tasks] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: [
          { allDay: false, startAt: { lt: rangeEnd }, endAt: { gt: rangeStart } },
          { allDay: true, startDate: { lt: dateEnd }, endDate: { gt: dateStart } },
        ],
      },
      include: { calendar: { select: { color: true } } },
      orderBy: [{ startAt: "asc" }, { startDate: "asc" }],
    }),
    prisma.project.findMany({
      where: {
        userId,
        status: { not: "archived" },
        OR: [
          { startDate: { gte: rangeStart, lt: rangeEnd } },
          { dueDate: { gte: rangeStart, lt: rangeEnd } },
        ],
      },
      select: { id: true, title: true, startDate: true, dueDate: true, clientId: true },
    }),
    prisma.milestone.findMany({
      where: {
        project: { userId },
        completed: false,
        dueDate: { gte: rangeStart, lt: rangeEnd },
      },
      select: { id: true, title: true, dueDate: true, projectId: true },
    }),
    prisma.invoice.findMany({
      where: {
        userId,
        status: { notIn: ["paid", "cancelled"] },
        dueDate: { gte: rangeStart, lt: rangeEnd },
      },
      select: { id: true, invoiceNumber: true, dueDate: true, projectId: true, clientId: true },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { notIn: ["done", "cancelled"] },
        OR: [
          { scheduledStartAt: { gte: rangeStart, lt: rangeEnd } },
          { scheduledStartAt: null, dueDate: { gte: rangeStart, lt: rangeEnd } },
        ],
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        timeZone: true,
        projectId: true,
        milestoneId: true,
      },
    }),
  ]);

  const derived: CalendarEventDto[] = [];
  const pushDateMarker = (
    id: string,
    title: string,
    date: Date,
    color: string,
    links: Partial<Pick<CalendarEventDto, "projectId" | "clientId" | "milestoneId" | "invoiceId">>,
  ) => {
    const startDateValue = date.toISOString().slice(0, 10);
    derived.push({
      id,
      calendarId: defaultCalendar.id,
      title,
      description: null,
      location: null,
      meetingUrl: null,
      startAt: null,
      endAt: null,
      startDate: startDateValue,
      endDate: addDays(startDateValue, 1),
      allDay: true,
      timeZone: defaultCalendar.timeZone,
      availability: "free",
      status: "confirmed",
      source: "derived",
      color,
      clientId: links.clientId || null,
      projectId: links.projectId || null,
      milestoneId: links.milestoneId || null,
      taskId: null,
      invoiceId: links.invoiceId || null,
      linkBehavior: "domain_owned",
      readOnly: true,
    });
  };

  for (const project of projects) {
    if (project.startDate && project.startDate >= rangeStart && project.startDate < rangeEnd) {
      pushDateMarker(`project-start:${project.id}`, `Start · ${project.title}`, project.startDate, "#0EA5E9", {
        projectId: project.id,
        clientId: project.clientId || undefined,
      });
    }
    if (project.dueDate && project.dueDate >= rangeStart && project.dueDate < rangeEnd) {
      pushDateMarker(`project-due:${project.id}`, `Deadline · ${project.title}`, project.dueDate, "#F97316", {
        projectId: project.id,
        clientId: project.clientId || undefined,
      });
    }
  }
  for (const milestone of milestones) {
    if (milestone.dueDate) {
      pushDateMarker(`milestone:${milestone.id}`, milestone.title, milestone.dueDate, "#8B5CF6", {
        projectId: milestone.projectId,
        milestoneId: milestone.id,
      });
    }
  }
  for (const invoice of invoices) {
    if (invoice.dueDate) {
      pushDateMarker(`invoice:${invoice.id}`, `Invoice ${invoice.invoiceNumber} due`, invoice.dueDate, "#E11D48", {
        projectId: invoice.projectId || undefined,
        clientId: invoice.clientId || undefined,
        invoiceId: invoice.id,
      });
    }
  }
  for (const task of tasks) {
    if (task.scheduledStartAt && task.scheduledEndAt) {
      derived.push({
        id: `task:${task.id}`,
        calendarId: defaultCalendar.id,
        title: task.title,
        description: null,
        location: null,
        meetingUrl: null,
        startAt: task.scheduledStartAt.toISOString(),
        endAt: task.scheduledEndAt.toISOString(),
        startDate: null,
        endDate: null,
        allDay: false,
        timeZone: task.timeZone || defaultCalendar.timeZone,
        availability: "busy",
        status: "confirmed",
        source: "task",
        color: "#14B8A6",
        clientId: null,
        projectId: task.projectId,
        milestoneId: task.milestoneId,
        taskId: task.id,
        invoiceId: null,
        linkBehavior: "domain_owned",
        readOnly: false,
      });
    } else if (task.dueDate) {
      pushDateMarker(`task-due:${task.id}`, task.title, task.dueDate, "#14B8A6", {
        projectId: task.projectId || undefined,
        milestoneId: task.milestoneId || undefined,
      });
      derived[derived.length - 1].taskId = task.id;
    }
  }

  return [...nativeEvents.map(nativeEventDto), ...derived].sort((left, right) =>
    (left.startAt || left.startDate || "").localeCompare(right.startAt || right.startDate || ""),
  );
}

export function hashSubscriptionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsDateTime(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function eventsToIcs(events: CalendarEventDto[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//rive.work//Rive Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:rive.",
  ];
  for (const event of events) {
    lines.push("BEGIN:VEVENT", `UID:${escapeIcs(event.id)}@rive.work`);
    if (event.allDay && event.startDate && event.endDate) {
      lines.push(
        `DTSTART;VALUE=DATE:${event.startDate.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${event.endDate.replace(/-/g, "")}`,
      );
    } else if (event.startAt && event.endAt) {
      lines.push(`DTSTART:${icsDateTime(event.startAt)}`, `DTEND:${icsDateTime(event.endAt)}`);
    }
    lines.push(`SUMMARY:${escapeIcs(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
    lines.push(`STATUS:${event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
