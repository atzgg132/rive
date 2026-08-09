import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const connections = await prisma.connectorConnection.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      providerAccountId: true,
      accountLabel: true,
      status: true,
      settings: true,
      lastSyncedAt: true,
      lastError: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ success: true, connections });
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, message: "Connection ID is required." }, { status: 400 });
  const deleted = await prisma.connectorConnection.deleteMany({ where: { id, userId: session.userId } });
  if (!deleted.count) return NextResponse.json({ success: false, message: "Connection not found." }, { status: 404 });
  await prisma.auditEvent.create({
    data: { userId: session.userId, action: "connector.disconnected", targetType: "connector_connection", targetId: id },
  });
  return NextResponse.json({ success: true });
}
