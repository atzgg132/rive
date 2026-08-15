import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { hasAdminSession } from "@/utils/adminSession";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await hasAdminSession(req)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const [user, events, audit, invoiceEvents] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, createdAt: true, accountType: true, onboardingStatus: true, businessType: true, profession: true, onboardingData: true, attribution: true } }),
    prisma.productEvent.findMany({ where: { userId: id }, orderBy: { occurredAt: "desc" }, take: 100 }),
    prisma.auditEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, action: true, targetType: true, targetId: true, metadata: true, createdAt: true } }),
    prisma.invoiceEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, invoiceId: true, eventType: true, metadata: true, createdAt: true } }),
  ]);
  if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
  const timeline = [
    ...events.map((event) => ({ id: event.id, kind: "product_event", type: event.eventName, module: event.module, at: event.occurredAt, metadata: event.properties })),
    ...audit.map((event) => ({ id: event.id, kind: "audit", type: event.action, module: event.targetType, at: event.createdAt, metadata: event.metadata })),
    ...invoiceEvents.map((event) => ({ id: event.id, kind: "invoice_event", type: event.eventType, module: "invoices", at: event.createdAt, metadata: { ...(event.metadata && typeof event.metadata === "object" ? event.metadata : {}), invoiceId: event.invoiceId } })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 200);
  return NextResponse.json({ success: true, user, timeline });
}
