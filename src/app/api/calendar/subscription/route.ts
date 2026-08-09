import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { hashSubscriptionToken } from "@/utils/calendar";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const subscription = await prisma.calendarSubscription.findFirst({
    where: { userId: session.userId, revokedAt: null },
    select: { id: true, label: true, createdAt: true },
  });
  return NextResponse.json({ success: true, subscription, hasActiveFeed: Boolean(subscription) });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.calendarSubscription.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.calendarSubscription.create({
      data: { userId: session.userId, tokenHash: hashSubscriptionToken(token) },
    }),
  ]);
  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return NextResponse.json({
    success: true,
    feedUrl: `${baseUrl}/api/calendar/feed/${token}`,
    webcalUrl: `webcal://${baseUrl.replace(/^https?:\/\//, "")}/api/calendar/feed/${token}`,
  }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  await prisma.calendarSubscription.updateMany({
    where: { userId: session.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
