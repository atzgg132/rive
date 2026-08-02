import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const notifications = await prisma.notification.findMany({ where: { userId: session.userId, ...(unreadOnly ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" }, take: 50 });
    return NextResponse.json({ success: true, notifications: notifications.map((notification) => ({ id: notification.id, type: notification.type, title: notification.title, message: notification.message, href: notification.href, read_at: notification.readAt, created_at: notification.createdAt })) });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json({ success: false, message: "Unable to load notifications." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const parsedBody = await req.json().catch(() => ({}));
    const body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody) ? parsedBody as { id?: unknown; all?: unknown } : {};
    if (body.all === true) await prisma.notification.updateMany({ where: { userId: session.userId, readAt: null }, data: { readAt: new Date() } });
    else if (typeof body.id === "string") await prisma.notification.updateMany({ where: { id: body.id, userId: session.userId }, data: { readAt: new Date() } });
    else return NextResponse.json({ success: false, message: "Notification ID or all=true is required." }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification update error:", error);
    return NextResponse.json({ success: false, message: "Unable to update notification." }, { status: 500 });
  }
}
