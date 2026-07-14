import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/utils/db";
import { verifyToken } from "@/utils/auth";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (!verifyToken(token)) {
    return NextResponse.json({ success: false, message: "unauthorised." }, { status: 401 });
  }

  try {
    const pool = getDbPool();

    const [totalSignups, last24h, last7d, remitInterest, approvedCount, totalViews, topPaths, rawSignups, rawViews, typeBreakdown] =
      await Promise.all([
        pool.query("SELECT COUNT(*)::int AS count FROM waitlist;"),
        pool.query("SELECT COUNT(*)::int AS count FROM waitlist WHERE created_at >= NOW() - INTERVAL '24 hours';"),
        pool.query("SELECT COUNT(*)::int AS count FROM waitlist WHERE created_at >= NOW() - INTERVAL '7 days';"),
        pool.query("SELECT COUNT(*)::int AS count FROM waitlist WHERE type = 'remit';"),
        pool.query("SELECT COUNT(*)::int AS count FROM waitlist WHERE status = 'approved';"),
        pool.query("SELECT COUNT(*)::int AS count FROM page_views;"),
        pool.query("SELECT path, COUNT(*)::int AS views FROM page_views GROUP BY path ORDER BY views DESC LIMIT 10;"),
        pool.query("SELECT created_at FROM waitlist WHERE created_at >= NOW() - INTERVAL '14 days' ORDER BY created_at ASC;"),
        pool.query("SELECT visited_at FROM page_views WHERE visited_at >= NOW() - INTERVAL '14 days' ORDER BY visited_at ASC;"),
        pool.query("SELECT type, COUNT(*)::int AS count FROM waitlist GROUP BY type ORDER BY count DESC;"),
      ]);

    // Group signups by day in JS (database-agnostic)
    const signupsMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      signupsMap.set(key, 0);
    }
    rawSignups.rows.forEach((row: any) => {
      const dateStr = new Date(row.created_at).toISOString().split("T")[0];
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
    rawViews.rows.forEach((row: any) => {
      const dateStr = new Date(row.visited_at).toISOString().split("T")[0];
      if (viewsMap.has(dateStr)) {
        viewsMap.set(dateStr, (viewsMap.get(dateStr) || 0) + 1);
      }
    });
    const viewsPerDay = Array.from(viewsMap.entries()).map(([day, count]) => ({ day, count }));

    return NextResponse.json({
      success: true,
      data: {
        totalSignups:  totalSignups.rows[0].count,
        last24h:       last24h.rows[0].count,
        last7d:        last7d.rows[0].count,
        remitInterest: remitInterest.rows[0].count,
        approvedCount: approvedCount.rows[0].count,
        totalViews:    totalViews.rows[0].count,
        topPaths:      topPaths.rows,
        signupsPerDay,
        viewsPerDay,
        typeBreakdown: typeBreakdown.rows,
      },
    });
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
