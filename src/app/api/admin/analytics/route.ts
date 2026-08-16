import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { hasAdminSession } from "@/utils/adminSession";
import { getAdminMetrics, type AdminMetrics } from "@/utils/adminMetrics";

export const dynamic = "force-dynamic";

function utcDayStart(now: Date, daysAgo: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`admin analytics timed out after ${timeoutMs}ms`)), timeoutMs);
      timer.unref?.();
    }),
  ]);
}

type LegacyAnalytics = {
  totalSignups: number;
  last24h: number;
  last7d: number;
  remitInterest: number;
  approvedCount: number;
  totalViews: number;
  topPaths: Array<{ path: string; views: number }>;
  signupsPerDay: Array<{ day: string; count: number }>;
  viewsPerDay: Array<{ day: string; count: number }>;
  typeBreakdown: Array<{ type: string; count: number }>;
};

function emptyLegacyAnalytics(now: Date): LegacyAnalytics {
  const days = Array.from({ length: 14 }, (_, index) => {
    const start = utcDayStart(now, 13 - index);
    return start.toISOString().slice(0, 10);
  });
  return {
    totalSignups: 0,
    last24h: 0,
    last7d: 0,
    remitInterest: 0,
    approvedCount: 0,
    totalViews: 0,
    topPaths: [],
    signupsPerDay: days.map((day) => ({ day, count: 0 })),
    viewsPerDay: days.map((day) => ({ day, count: 0 })),
    typeBreakdown: [],
  };
}

async function readLegacyAnalytics(now: Date): Promise<LegacyAnalytics> {
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const days = Array.from({ length: 14 }, (_, index) => {
    const start = utcDayStart(now, 13 - index);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000), day: start.toISOString().slice(0, 10) };
  });

  try {
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
    ]);

    return {
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
    };
  } catch (error) {
    console.warn("Legacy admin analytics unavailable:", error instanceof Error ? error.message : error);
    return emptyLegacyAnalytics(now);
  }
}

export async function GET(req: NextRequest) {
  if (!await hasAdminSession(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const includeLegacy = new URL(req.url).searchParams.get("includeLegacy") === "true";
  const [legacy, funnelResult] = await Promise.all([
    includeLegacy
      ? withTimeout(readLegacyAnalytics(now), 10_000).catch((error) => {
        console.warn("Legacy admin analytics timed out:", error instanceof Error ? error.message : error);
        return emptyLegacyAnalytics(now);
      })
      : Promise.resolve(emptyLegacyAnalytics(now)),
    withTimeout(getAdminMetrics(), 10_000)
      .then((productFunnel) => ({ productFunnel, status: "ready" as const }))
      .catch((error) => {
        console.warn("Product funnel metrics unavailable:", error instanceof Error ? error.message : error);
        return { productFunnel: null as AdminMetrics | null, status: "unavailable" as const };
      }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      ...legacy,
      productFunnel: funnelResult.productFunnel,
      productFunnelStatus: funnelResult.status,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
