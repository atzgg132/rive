import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { mergePortfolioContent } from "@/utils/portfolio";
import {
  attentionShare,
  conversionRate,
  isUnconvertedProject,
  normalizePortfolioReferrer,
  parsePortfolioAnalyticsRange,
  percentageChange,
  PORTFOLIO_ANALYTICS_ESTIMATE_NOTE,
  PORTFOLIO_ANALYTICS_RANGES,
  portfolioTimelineDays,
  resolvePortfolioAnalyticsWindow,
  type PortfolioAnalyticsPayload,
  type PortfolioAnalyticsProject,
} from "@/utils/portfolioAnalytics";

/**
 * Portfolio analytics.
 *
 * Every figure is aggregated in Postgres. The previous version read every view
 * row for the window into memory and counted in JavaScript, which was tolerable
 * only because the window was hard-coded to 30 days; with an "all" range that
 * approach would load a portfolio's entire history to produce eight numbers.
 *
 * Enquiries marked spam are excluded from totals and from the conversion rate —
 * they are not leads — but they still appear in the status breakdown so an owner
 * can see what was filtered.
 */

/** Bounded group cardinality: read enough rows to rank honestly, never all of them. */
const REFERRER_GROUP_LIMIT = 50;
const REFERRER_DISPLAY_LIMIT = 8;
const PROJECT_GROUP_LIMIT = 50;

type CountRow = { views: number; visitors: number; portfolio_views: number; project_views: number };
type DayRow = { day: string; views: number };
type GroupRow = { key: string | null; views: number };
type ProjectRow = { project_id: string; views: number; visitors: number };

function viewedSince(since: Date | null) {
  return since ? Prisma.sql`AND "viewed_at" >= ${since}` : Prisma.empty;
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const range = parsePortfolioAnalyticsRange(req.nextUrl.searchParams.get("range"));
  if (!range) {
    return NextResponse.json(
      {
        success: false,
        message: `Choose one of these ranges: ${PORTFOLIO_ANALYTICS_RANGES.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  try {
    // Tenant scope: the portfolio is resolved from the session user, so no
    // identifier from the request ever selects which data is read.
    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: session.userId },
      select: { id: true, content: true },
    });
    if (!portfolio) return NextResponse.json({ success: false, message: "Create a portfolio first." }, { status: 404 });

    const now = new Date();
    const window = resolvePortfolioAnalyticsWindow(range, now);
    const previous = window.previous;
    const portfolioId = portfolio.id;

    const [
      totalRows,
      previousRows,
      timelineRows,
      referrerRows,
      deviceRows,
      projectRows,
      previousProjectRows,
      earliestView,
      inquiryStatusGroups,
      inquiriesInRange,
      previousInquiries,
      latestInquiry,
      notificationFailures,
      projectInquiryGroups,
    ] = await Promise.all([
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::int AS views,
               COUNT(DISTINCT "visitor_hash")::int AS visitors,
               COUNT(*) FILTER (WHERE "page_type" = 'portfolio')::int AS portfolio_views,
               COUNT(*) FILTER (WHERE "page_type" = 'project')::int AS project_views
        FROM "portfolio_views"
        WHERE "portfolio_id" = ${portfolioId} ${viewedSince(window.since)}
      `),
      previous
        ? prisma.$queryRaw<CountRow[]>(Prisma.sql`
            SELECT COUNT(*)::int AS views,
                   COUNT(DISTINCT "visitor_hash")::int AS visitors,
                   COUNT(*) FILTER (WHERE "page_type" = 'portfolio')::int AS portfolio_views,
                   COUNT(*) FILTER (WHERE "page_type" = 'project')::int AS project_views
            FROM "portfolio_views"
            WHERE "portfolio_id" = ${portfolioId}
              AND "viewed_at" >= ${previous.since} AND "viewed_at" < ${previous.until}
          `)
        : Promise.resolve([] as CountRow[]),
      prisma.$queryRaw<DayRow[]>(Prisma.sql`
        SELECT to_char(date_trunc('day', "viewed_at"), 'YYYY-MM-DD') AS day, COUNT(*)::int AS views
        FROM "portfolio_views"
        WHERE "portfolio_id" = ${portfolioId} ${viewedSince(window.since)}
        GROUP BY 1
        ORDER BY 1
      `),
      prisma.$queryRaw<GroupRow[]>(Prisma.sql`
        SELECT "referrer" AS key, COUNT(*)::int AS views
        FROM "portfolio_views"
        WHERE "portfolio_id" = ${portfolioId} ${viewedSince(window.since)}
        GROUP BY 1
        ORDER BY views DESC
        LIMIT ${REFERRER_GROUP_LIMIT}
      `),
      prisma.$queryRaw<GroupRow[]>(Prisma.sql`
        SELECT "device_type" AS key, COUNT(*)::int AS views
        FROM "portfolio_views"
        WHERE "portfolio_id" = ${portfolioId} ${viewedSince(window.since)}
        GROUP BY 1
        ORDER BY views DESC
      `),
      prisma.$queryRaw<ProjectRow[]>(Prisma.sql`
        SELECT "project_id", COUNT(*)::int AS views, COUNT(DISTINCT "visitor_hash")::int AS visitors
        FROM "portfolio_views"
        WHERE "portfolio_id" = ${portfolioId}
          AND "page_type" = 'project' AND "project_id" IS NOT NULL
          ${viewedSince(window.since)}
        GROUP BY 1
        ORDER BY views DESC
        LIMIT ${PROJECT_GROUP_LIMIT}
      `),
      previous
        ? prisma.$queryRaw<Pick<ProjectRow, "project_id" | "views">[]>(Prisma.sql`
            SELECT "project_id", COUNT(*)::int AS views
            FROM "portfolio_views"
            WHERE "portfolio_id" = ${portfolioId}
              AND "page_type" = 'project' AND "project_id" IS NOT NULL
              AND "viewed_at" >= ${previous.since} AND "viewed_at" < ${previous.until}
            GROUP BY 1
          `)
        : Promise.resolve([] as Pick<ProjectRow, "project_id" | "views">[]),
      // Only needed to bound an open-ended timeline.
      range === "all"
        ? prisma.portfolioView.aggregate({ where: { portfolioId }, _min: { viewedAt: true } })
        : Promise.resolve(null),
      prisma.portfolioInquiry.groupBy({
        by: ["status"],
        where: { portfolioId },
        _count: { _all: true },
      }),
      prisma.portfolioInquiry.count({
        where: { portfolioId, status: { not: "spam" }, ...(window.since ? { createdAt: { gte: window.since } } : {}) },
      }),
      previous
        ? prisma.portfolioInquiry.count({
            where: { portfolioId, status: { not: "spam" }, createdAt: { gte: previous.since, lt: previous.until } },
          })
        : Promise.resolve(null),
      prisma.portfolioInquiry.findFirst({
        where: { portfolioId, status: { not: "spam" } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.portfolioInquiry.count({ where: { portfolioId, notificationStatus: "failed" } }),
      prisma.portfolioInquiry.groupBy({
        by: ["sourceProjectId"],
        where: {
          portfolioId,
          status: { not: "spam" },
          sourceProjectId: { not: null },
          ...(window.since ? { createdAt: { gte: window.since } } : {}),
        },
        _count: { _all: true },
      }),
    ]);

    const totals = totalRows[0] ?? { views: 0, visitors: 0, portfolio_views: 0, project_views: 0 };
    const priorTotals = previousRows[0] ?? null;

    /* Referrers are re-normalized on read so historical rows written before the
       normalizer existed collapse into the same source as new ones. Grouping
       happens in Postgres first, so this merge only ever walks the distinct
       referrer values, not the view rows. */
    const referrerTotals = new Map<string, number>();
    for (const row of referrerRows) {
      const source = normalizePortfolioReferrer(row.key) || "direct";
      referrerTotals.set(source, (referrerTotals.get(source) || 0) + row.views);
    }

    const timelineByDay = new Map(timelineRows.map((row) => [row.day, row.views]));
    const timeline = portfolioTimelineDays(window, earliestView?._min.viewedAt ?? null).map((day) => ({
      day,
      views: timelineByDay.get(day) || 0,
    }));

    const content = mergePortfolioContent(portfolio.content);
    const projectTitles = new Map(content.projects.map((project) => [project.id, project.title]));
    const previousProjectViews = new Map(previousProjectRows.map((row) => [row.project_id, row.views]));
    const projectInquiries = new Map(
      projectInquiryGroups.map((group) => [group.sourceProjectId as string, group._count._all]),
    );
    const totalProjectViews = totals.project_views;

    const projects: PortfolioAnalyticsProject[] = projectRows.map((row) => {
      const title = projectTitles.get(row.project_id);
      const inquiries = projectInquiries.get(row.project_id) || 0;
      return {
        projectId: row.project_id,
        /* A view outlives the project it was recorded against. Renaming shows
           the new title; deleting keeps the history and says so, rather than
           dropping the row or showing a bare identifier. */
        title: title?.trim() || (title === undefined ? "Removed project" : "Untitled project"),
        exists: title !== undefined,
        views: row.views,
        estimatedVisitors: row.visitors,
        attentionShare: attentionShare(row.views, totalProjectViews),
        change: percentageChange(row.views, previous ? previousProjectViews.get(row.project_id) ?? 0 : null),
        inquiries,
        unconverted: isUnconvertedProject({ views: row.views, inquiries, totalInquiries: inquiriesInRange }),
      };
    });

    const byStatus: Record<string, number> = {};
    let inquiryTotal = 0;
    for (const group of inquiryStatusGroups) {
      byStatus[group.status] = group._count._all;
      if (group.status !== "spam") inquiryTotal += group._count._all;
    }

    const currentConversion = conversionRate(inquiriesInRange, totals.views);
    const previousConversion =
      priorTotals && previousInquiries !== null ? conversionRate(previousInquiries, priorTotals.views) : null;

    const payload: PortfolioAnalyticsPayload = {
      range,
      generatedAt: now.toISOString(),
      window: {
        since: window.since?.toISOString() ?? null,
        until: window.until.toISOString(),
        days: window.days,
        comparable: previous !== null,
      },
      totals: {
        views: totals.views,
        estimatedVisitors: totals.visitors,
        portfolioViews: totals.portfolio_views,
        projectViews: totals.project_views,
        inquiries: inquiriesInRange,
        conversionRate: currentConversion,
      },
      changes: {
        views: percentageChange(totals.views, priorTotals?.views ?? null),
        estimatedVisitors: percentageChange(totals.visitors, priorTotals?.visitors ?? null),
        inquiries: percentageChange(inquiriesInRange, previousInquiries),
        conversionRatePoints:
          previousConversion === null ? null : Math.round((currentConversion - previousConversion) * 10) / 10,
      },
      timeline,
      referrers: [...referrerTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, REFERRER_DISPLAY_LIMIT)
        .map(([source, views]) => ({ source, views })),
      devices: deviceRows.map((row) => ({ device: row.key || "unknown", views: row.views })),
      projects,
      inquiries: {
        total: inquiryTotal,
        unread: byStatus.new || 0,
        inRange: inquiriesInRange,
        latestAt: latestInquiry?.createdAt.toISOString() ?? null,
        byStatus,
        notificationFailures,
      },
      estimateNote: PORTFOLIO_ANALYTICS_ESTIMATE_NOTE,
    };

    return NextResponse.json({ success: true, analytics: payload }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Portfolio analytics error:", error);
    return NextResponse.json({ success: false, message: "Could not load portfolio analytics." }, { status: 500 });
  }
}
