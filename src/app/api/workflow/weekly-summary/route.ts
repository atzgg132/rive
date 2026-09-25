import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { readJsonBody } from "@/utils/apiBoundary";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { weeklySummaryEnabled: true, weeklySummaryLastSentAt: true },
  });
  if (!user) return NextResponse.json({ success: false, message: "Account not found." }, { status: 404 });
  return NextResponse.json({
    success: true,
    enabled: user.weeklySummaryEnabled,
    lastSentAt: user.weeklySummaryLastSentAt?.toISOString() || null,
  });
}

/** Toggles the opt-in weekly business summary email. Off by default (issue #66, PR 5). */
export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const enabled = parsedBody.body.enabled;
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ success: false, message: "`enabled` must be a boolean." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.userId }, data: { weeklySummaryEnabled: enabled } });
  await recordProductEvent({
    userId: session.userId,
    eventName: enabled ? PRODUCT_EVENTS.weeklySummaryEnabled : PRODUCT_EVENTS.weeklySummaryDisabled,
    module: "weekly_summary",
    source: "settings",
  });
  return NextResponse.json({ success: true, enabled });
}
