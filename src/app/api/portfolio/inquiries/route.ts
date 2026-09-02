import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import {
  inquiryExcerpt,
  isInquiryStatus,
  parseInquiryPageSize,
  type PortfolioInquiryNotificationStatus,
  type PortfolioInquiryStatus,
  type PortfolioInquirySummary,
} from "@/utils/portfolioInquiries";

/**
 * The portfolio owner's enquiry inbox.
 *
 * Tenant scope comes from the session user only: `userId` is on every enquiry
 * row precisely so this filter never depends on a value from the request.
 */

const MAX_SEARCH_LENGTH = 120;

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const statusFilter = params.get("status");
  if (statusFilter && statusFilter !== "all" && !isInquiryStatus(statusFilter)) {
    return NextResponse.json({ success: false, message: "Unknown enquiry status filter." }, { status: 400 });
  }

  const search = (params.get("search") || "").trim().slice(0, MAX_SEARCH_LENGTH);
  const pageSize = parseInquiryPageSize(params.get("pageSize"));
  const requestedPage = Number.parseInt(params.get("page") || "", 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  try {
    const where: Prisma.PortfolioInquiryWhereInput = {
      userId: session.userId,
      ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { projectType: { contains: search, mode: "insensitive" } },
              { message: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total, statusGroups] = await Promise.all([
      prisma.portfolioInquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          projectType: true,
          message: true,
          status: true,
          notificationStatus: true,
          createdAt: true,
          readAt: true,
          repliedAt: true,
          convertedAt: true,
          convertedProject: { select: { id: true, title: true } },
          sourceTask: { select: { id: true, title: true } },
        },
      }),
      prisma.portfolioInquiry.count({ where }),
      // Filter-independent, so the tab counts do not move as the reader filters.
      prisma.portfolioInquiry.groupBy({
        by: ["status"],
        where: { userId: session.userId },
        _count: { _all: true },
      }),
    ]);

    const counts: Record<string, number> = { all: 0 };
    for (const group of statusGroups) {
      counts[group.status] = group._count._all;
      counts.all += group._count._all;
    }

    const inquiries: PortfolioInquirySummary[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      projectType: row.projectType,
      excerpt: inquiryExcerpt(row.message),
      status: row.status as PortfolioInquiryStatus,
      notificationStatus: row.notificationStatus as PortfolioInquiryNotificationStatus,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
      repliedAt: row.repliedAt?.toISOString() ?? null,
      convertedAt: row.convertedAt?.toISOString() ?? null,
      convertedProjectId: row.convertedProject?.id ?? null,
      convertedProjectTitle: row.convertedProject?.title ?? null,
      followUpTaskId: row.sourceTask?.id ?? null,
      followUpTaskTitle: row.sourceTask?.title ?? null,
    }));

    return NextResponse.json(
      {
        success: true,
        inquiries,
        counts,
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
        unread: counts.new || 0,
        notificationFailures: await prisma.portfolioInquiry.count({
          where: { userId: session.userId, notificationStatus: "failed" },
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Portfolio inquiries list error:", error);
    return NextResponse.json({ success: false, message: "Could not load your enquiries." }, { status: 500 });
  }
}
