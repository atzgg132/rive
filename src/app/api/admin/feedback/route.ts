import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { hasAdminSession } from "@/utils/adminSession";

const STATUSES = new Set(["new", "reviewing", "planned", "closed"]);
const MAX_SEARCH = 120;

export async function GET(req: NextRequest) {
  if (!await hasAdminSession(req)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const page = Math.max(Number.parseInt(params.get("page") || "1", 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(params.get("pageSize") || "25", 10) || 25, 1), 50);
  const status = params.get("status") || "all";
  const search = (params.get("search") || "").trim().slice(0, MAX_SEARCH);

  const where: Prisma.FeedbackWhereInput = {
    ...(status !== "all" ? { status } : {}),
    ...(search
      ? {
          OR: [
            { body: { contains: search, mode: "insensitive" } },
            { module: { contains: search, mode: "insensitive" } },
            { promptKey: { contains: search, mode: "insensitive" } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { user: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, data, statusGroups, ratingSummary, contactable] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { email: true, name: true } } },
    }),
    /* Counts are deliberately unfiltered by the current status or search, so the
       tabs do not renumber themselves as the reader moves between them. */
    prisma.feedback.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.feedback.aggregate({ _avg: { rating: true }, _count: { rating: true } }),
    prisma.feedback.count({ where: { contactAllowed: true } }),
  ]);

  const counts: Record<string, number> = { all: 0 };
  for (const group of statusGroups) {
    counts[group.status] = group._count._all;
    counts.all += group._count._all;
  }

  return NextResponse.json({
    success: true,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
    data,
    summary: {
      counts,
      averageRating: ratingSummary._avg.rating ? Math.round(ratingSummary._avg.rating * 10) / 10 : null,
      ratedCount: ratingSummary._count.rating,
      contactable,
    },
  });
}

export async function PATCH(req: NextRequest) {
  if (!await hasAdminSession(req)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const body = await req.json().catch(() => null) as { id?: unknown; status?: unknown; tags?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const tags = Array.isArray(body?.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 20) : undefined;
  if (!id || !STATUSES.has(status)) return NextResponse.json({ success: false, message: "Invalid feedback update." }, { status: 400 });
  const feedback = await prisma.feedback.update({ where: { id }, data: { status, ...(tags ? { tags } : {}) } });
  return NextResponse.json({ success: true, feedback });
}
