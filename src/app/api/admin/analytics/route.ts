import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { hasAdminSession } from "@/utils/adminSession";
import { getAdminMetrics } from "@/utils/adminMetrics";

function utcDayStart(now: Date, daysAgo: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
}

export async function GET(req: NextRequest) {
  if (!await hasAdminSession(req)) {
    return NextResponse.json({ success: false, message: "unauthorised." }, { status: 401 });
  }

  try {
    const now = new Date();
    const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days = Array.from({ length: 14 }, (_, index) => {
      const start = utcDayStart(now, 13 - index);
      return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000), day: start.toISOString().slice(0, 10) };
    });

    const [
      totalSignups,
      last24h,
      last7d,
      remitInterest,
      approvedCount,
      totalViews,
      rawTypeBreakdown,
      rawTopPaths,
      signupsByDay,
      viewsByDay,
      productFunnel,
    ] = await Promise.all([
      prisma.waitlist.count(),
      prisma.waitlist.count({ where: { createdAt: { gte: ago24h } } }),
      prisma.waitlist.count({ where: { createdAt: { gte: ago7d } } }),
      prisma.waitlist.count({ where: { type: "remit" } }),
      prisma.waitlist.count({ where: { status: "approved" } }),
      prisma.pageView.count(),
      prisma.waitlist.groupBy({ by: ["type"], _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.pageView.groupBy({ by: ["path"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
      Promise.all(days.map((day) => prisma.waitlist.count({ where: { createdAt: { gte: day.start, lt: day.end } } }))),
      Promise.all(days.map((day) => prisma.pageView.count({ where: { visitedAt: { gte: day.start, lt: day.end } } }))),
      getAdminMetrics().catch((error) => {
        console.warn("Product funnel metrics unavailable until the open-beta migration is applied.", error instanceof Error ? error.message : error);
        return null;
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        // These fields are retained for old admin clients; the active product
        // dashboard reads productFunnel instead of treating the waitlist as a
        // live acquisition funnel.
        totalSignups,
        last24h,
        last7d,
        remitInterest,
        approvedCount,
        totalViews,
        topPaths: rawTopPaths.map((item) => ({ path: item.path, views: item._count.id })),
        signupsPerDay: days.map((day, index) => ({ day: day.day, count: signupsByDay[index] || 0 })),
        viewsPerDay: days.map((day, index) => ({ day: day.day, count: viewsByDay[index] || 0 })),
        typeBreakdown: rawTypeBreakdown.map((item) => ({ type: item.type, count: item._count.id })),
        productFunnel,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    console.error("Analytics fetch error:", error);
    // Never return stack traces or provider/database details through an admin
    // API. The server log retains the diagnostic context.
    return NextResponse.json({ success: false, message: "Analytics are temporarily unavailable." }, { status: 503 });
  }
}
