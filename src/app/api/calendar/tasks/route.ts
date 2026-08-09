import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { isDateOnly, isValidTimeZone } from "@/utils/calendar";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const tasks = await prisma.task.findMany({
    where: { userId: session.userId, status: { notIn: ["done", "cancelled"] } },
    include: { project: { select: { title: true } } },
    orderBy: [{ scheduledStartAt: "asc" }, { dueDate: "asc" }, { priority: "asc" }],
  });
  return NextResponse.json({ success: true, tasks });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`calendar-task-create:${session.userId}:${getRequestIp(req)}`, 120, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many tasks created. Please try again later." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ success: false, message: "A valid request body is required." }, { status: 400 });
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ success: false, message: "Task title is required." }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ success: false, message: "Task title must be 200 characters or fewer." }, { status: 400 });
  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.userId }, select: { id: true } });
    if (!project) return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
  }
  const dueDateValue = typeof body.dueDate === "string" && isDateOnly(body.dueDate) ? new Date(`${body.dueDate}T12:00:00Z`) : null;
  const task = await prisma.task.create({
    data: {
      userId: session.userId,
      title,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      projectId,
      priority: ["low", "medium", "high", "urgent"].includes(body.priority) ? body.priority : "medium",
      dueDate: dueDateValue,
      estimatedMinutes: Number.isInteger(body.estimatedMinutes) && body.estimatedMinutes > 0 ? Math.min(body.estimatedMinutes, 1440) : null,
      billable: body.billable === true,
    },
  });
  return NextResponse.json({ success: true, task }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ success: false, message: "A valid request body is required." }, { status: 400 });
  const id = typeof body.id === "string" ? body.id : "";
  const existing = await prisma.task.findFirst({ where: { id, userId: session.userId } });
  if (!existing) return NextResponse.json({ success: false, message: "Task not found." }, { status: 404 });
  const scheduledStartAt = body.scheduledStartAt === null ? null : typeof body.scheduledStartAt === "string" ? new Date(body.scheduledStartAt) : undefined;
  const scheduledEndAt = body.scheduledEndAt === null ? null : typeof body.scheduledEndAt === "string" ? new Date(body.scheduledEndAt) : undefined;
  if ((scheduledStartAt === undefined) !== (scheduledEndAt === undefined)) {
    return NextResponse.json({ success: false, message: "A task schedule requires both a start and end." }, { status: 400 });
  }
  if (
    scheduledStartAt instanceof Date &&
    scheduledEndAt instanceof Date &&
    (!Number.isFinite(scheduledStartAt.getTime()) || !Number.isFinite(scheduledEndAt.getTime()) || scheduledEndAt <= scheduledStartAt)
  ) {
    return NextResponse.json({ success: false, message: "Task schedule is invalid." }, { status: 400 });
  }
  const status = typeof body.status === "string" ? body.status : undefined;
  if (status && !["todo", "in_progress", "done", "cancelled"].includes(status)) {
    return NextResponse.json({ success: false, message: "Task status is invalid." }, { status: 400 });
  }
  const completed = status === "done";
  const task = await prisma.task.update({
    where: { id },
    data: {
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : undefined,
      status,
      completedAt: completed ? new Date() : status ? null : undefined,
      scheduledStartAt,
      scheduledEndAt,
      timeZone: typeof body.timeZone === "string" && isValidTimeZone(body.timeZone) ? body.timeZone : undefined,
    },
  });
  return NextResponse.json({ success: true, task });
}
