import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const portfolio = await prisma.portfolio.findUnique({ where: { userId: session.userId }, select: { id: true } });
    if (!portfolio) return NextResponse.json({ success: false, message: "Create a portfolio first." }, { status: 404 });

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - 29);
    const views = await prisma.portfolioView.findMany({
      where: { portfolioId: portfolio.id, viewedAt: { gte: since } },
      orderBy: { viewedAt: "asc" },
      select: { viewedAt: true, visitorHash: true, referrer: true, deviceType: true },
    });

    const days = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      days.set(day.toISOString().slice(0, 10), 0);
    }
    views.forEach((view) => {
      const key = view.viewedAt.toISOString().slice(0, 10);
      if (days.has(key)) days.set(key, (days.get(key) || 0) + 1);
    });

    const uniqueVisitors = new Set(views.map((view) => view.visitorHash).filter(Boolean)).size;
    const referrers = new Map<string, number>();
    const devices = new Map<string, number>();
    views.forEach((view) => {
      const referrer = view.referrer || "direct";
      referrers.set(referrer, (referrers.get(referrer) || 0) + 1);
      const device = view.deviceType || "unknown";
      devices.set(device, (devices.get(device) || 0) + 1);
    });

    return NextResponse.json({
      success: true,
      analytics: {
        totalViews: views.length,
        uniqueVisitors,
        averageViewsPerDay: Number((views.length / 30).toFixed(1)),
        peakDay: [...days.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
        timeline: [...days.entries()].map(([day, count]) => ({ day, count })),
        referrers: [...referrers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([source, count]) => ({ source, count })),
        devices: [...devices.entries()].sort((a, b) => b[1] - a[1]).map(([device, count]) => ({ device, count })),
      },
    });
  } catch (error) {
    console.error("Portfolio analytics error:", error);
    return NextResponse.json({ success: false, message: "Could not load portfolio analytics." }, { status: 500 });
  }
}
