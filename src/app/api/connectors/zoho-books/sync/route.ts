import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { verifyZohoConnection } from "@/utils/zohoBooks";
import { zohoBooksAvailable } from "@/utils/connectorConfig";

export async function POST(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!zohoBooksAvailable()) return NextResponse.json({ success: false, message: "Zoho Books direct migration is not available." }, { status: 503 });
  if (!rateLimit(`zoho-sync:${session.userId}:${getRequestIp(req)}`, 12, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many synchronization attempts." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const connectionId = typeof body?.connectionId === "string" ? body.connectionId : "";
  const connection = await prisma.connectorConnection.findFirst({
    where: { id: connectionId, userId: session.userId, provider: "zoho_books" },
  });
  if (!connection) return NextResponse.json({ success: false, message: "Zoho Books connection not found." }, { status: 404 });
  const run = await prisma.syncRun.create({
    data: {
      userId: session.userId,
      connectorConnectionId: connection.id,
      provider: "zoho_books",
      trigger: "manual",
      status: "running",
      attempts: 1,
      startedAt: new Date(),
    },
  });
  try {
    await verifyZohoConnection(connection.id);
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        summary: { connectionVerified: true, note: "Initial record ingestion activates after organization mapping is confirmed." },
        completedAt: new Date(),
      },
    });
    return NextResponse.json({
      success: true,
      runId: run.id,
      requiresImportConfirmation: true,
      message: "Connection verified. Confirm the organization and import scope before records are written.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Zoho Books verification failed.";
    await prisma.$transaction([
      prisma.syncRun.update({ where: { id: run.id }, data: { status: "failed", error: message, completedAt: new Date() } }),
      prisma.connectorConnection.update({ where: { id: connection.id }, data: { status: "error", lastError: message } }),
    ]);
    return NextResponse.json({ success: false, runId: run.id, message }, { status: 502 });
  }
}
