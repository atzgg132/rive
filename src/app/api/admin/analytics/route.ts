import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { verifyToken } from "@/utils/auth";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (!verifyToken(token)) {
    return NextResponse.json({ success: false, message: "unauthorised." }, { status: 401 });
  }

  try {
    const now = new Date();
    const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ago14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      totalSignups,
      last24h,
      last7d,
      remitInterest,
      approvedCount,
      totalViews,
      rawTypeBreakdown,
      rawTopPaths,
      rawSignups,
      rawViews
    ] = await Promise.all([
      prisma.waitlist.count(),
      prisma.waitlist.count({ where: { createdAt: { gte: ago24h } } }),
      prisma.waitlist.count({ where: { createdAt: { gte: ago7d } } }),
      prisma.waitlist.count({ where: { type: "remit" } }),
      prisma.waitlist.count({ where: { status: "approved" } }),
      prisma.pageView.count(),
      prisma.waitlist.groupBy({
        by: ["type"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } }
      }),
      prisma.pageView.groupBy({
        by: ["path"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10
      }),
      prisma.waitlist.findMany({
        where: { createdAt: { gte: ago14d } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" }
      }),
      prisma.pageView.findMany({
        where: { visitedAt: { gte: ago14d } },
        select: { visitedAt: true },
        orderBy: { visitedAt: "asc" }
      })
    ]);

    // Format type breakdown to match legacy structure
    const typeBreakdown = rawTypeBreakdown.map((item: any) => ({
      type: item.type,
      count: item._count.id
    }));

    // Format top paths to match legacy structure
    const topPaths = rawTopPaths.map((item: any) => ({
      path: item.path,
      views: item._count.id
    }));

    // Group signups by day in JS (database-agnostic)
    const signupsMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      signupsMap.set(key, 0);
    }
    rawSignups.forEach((row: any) => {
      const dateStr = new Date(row.createdAt).toISOString().split("T")[0];
      if (signupsMap.has(dateStr)) {
        signupsMap.set(dateStr, (signupsMap.get(dateStr) || 0) + 1);
      }
    });
    const signupsPerDay = Array.from(signupsMap.entries()).map(([day, count]) => ({ day, count }));

    // Group views by day in JS
    const viewsMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      viewsMap.set(key, 0);
    }
    rawViews.forEach((row: any) => {
      const dateStr = new Date(row.visitedAt).toISOString().split("T")[0];
      if (viewsMap.has(dateStr)) {
        viewsMap.set(dateStr, (viewsMap.get(dateStr) || 0) + 1);
      }
    });
    const viewsPerDay = Array.from(viewsMap.entries()).map(([day, count]) => ({ day, count }));

    return NextResponse.json({
      success: true,
      data: {
        totalSignups,
        last24h,
        last7d,
        remitInterest,
        approvedCount,
        totalViews,
        topPaths,
        signupsPerDay,
        viewsPerDay,
        typeBreakdown
      }
    });
  } catch (error: any) {
    console.error("Analytics fetch error:", error);
    return NextResponse.json({
      success: false,
      message: "Internal server error.",
      error: error.message || String(error),
      stack: error.stack || ""
    }, { status: 500 });
  }
}
