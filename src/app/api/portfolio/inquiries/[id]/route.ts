import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { mergePortfolioContent } from "@/utils/portfolio";
import {
  inquiryExcerpt,
  inquiryStatusTransition,
  type PortfolioInquiryDetail,
  type PortfolioInquiryNotificationStatus,
  type PortfolioInquiryStatus,
} from "@/utils/portfolioInquiries";

/**
 * One enquiry: read it, or move it through its lifecycle.
 *
 * Every query is scoped by the session user's id, and a miss answers 404 rather
 * than 403. Another tenant must not be able to tell the difference between an
 * enquiry that is not theirs and one that does not exist.
 */

const ACTIONS = ["read", "unread", "replied", "archived", "spam", "restore"] as const;
type InquiryAction = (typeof ACTIONS)[number];

function isAction(value: unknown): value is InquiryAction {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

const DETAIL_SELECT = {
  id: true,
  name: true,
  email: true,
  projectType: true,
  message: true,
  status: true,
  notificationStatus: true,
  notificationError: true,
  sourceProjectId: true,
  referrer: true,
  deviceType: true,
  createdAt: true,
  readAt: true,
  repliedAt: true,
} as const;

type DetailRow = {
  id: string;
  name: string;
  email: string;
  projectType: string;
  message: string;
  status: string;
  notificationStatus: string;
  notificationError: string | null;
  sourceProjectId: string | null;
  referrer: string | null;
  deviceType: string | null;
  createdAt: Date;
  readAt: Date | null;
  repliedAt: Date | null;
};

/** Resolves the source project's current title, if that project still exists. */
async function sourceProjectTitle(userId: string, sourceProjectId: string | null): Promise<string | null> {
  if (!sourceProjectId) return null;
  const portfolio = await prisma.portfolio.findUnique({ where: { userId }, select: { content: true } });
  if (!portfolio) return null;
  const project = mergePortfolioContent(portfolio.content).projects.find((item) => item.id === sourceProjectId);
  return project ? project.title.trim() || "Untitled project" : null;
}

function toDetail(row: DetailRow, projectTitle: string | null): PortfolioInquiryDetail {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    projectType: row.projectType,
    message: row.message,
    excerpt: inquiryExcerpt(row.message),
    status: row.status as PortfolioInquiryStatus,
    notificationStatus: row.notificationStatus as PortfolioInquiryNotificationStatus,
    notificationError: row.notificationError,
    sourceProjectId: row.sourceProjectId,
    sourceProjectTitle: projectTitle,
    referrer: row.referrer,
    deviceType: row.deviceType,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    repliedAt: row.repliedAt?.toISOString() ?? null,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await params;

  try {
    const row = await prisma.portfolioInquiry.findFirst({
      where: { id, userId: session.userId },
      select: DETAIL_SELECT,
    });
    if (!row) return NextResponse.json({ success: false, message: "Enquiry not found." }, { status: 404 });

    return NextResponse.json(
      { success: true, inquiry: toDetail(row, await sourceProjectTitle(session.userId, row.sourceProjectId)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Portfolio inquiry read error:", error);
    return NextResponse.json({ success: false, message: "Could not load this enquiry." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const action = (body as { action?: unknown } | null)?.action;
  if (!isAction(action)) {
    return NextResponse.json(
      { success: false, message: `Choose one of these actions: ${ACTIONS.join(", ")}.` },
      { status: 400 },
    );
  }

  try {
    const current = await prisma.portfolioInquiry.findFirst({
      where: { id, userId: session.userId },
      select: { id: true, status: true, readAt: true, repliedAt: true },
    });
    if (!current) return NextResponse.json({ success: false, message: "Enquiry not found." }, { status: 404 });

    const transition = inquiryStatusTransition(action, current);
    /* updateMany, not update: the tenant filter stays inside the write, so the
       row cannot be modified by anyone but its owner even if the read above and
       the write below were somehow to disagree. */
    const updated = await prisma.portfolioInquiry.updateMany({
      where: { id, userId: session.userId },
      data: transition,
    });
    if (updated.count !== 1) return NextResponse.json({ success: false, message: "Enquiry not found." }, { status: 404 });

    const row = await prisma.portfolioInquiry.findFirst({
      where: { id, userId: session.userId },
      select: DETAIL_SELECT,
    });
    if (!row) return NextResponse.json({ success: false, message: "Enquiry not found." }, { status: 404 });

    return NextResponse.json({
      success: true,
      inquiry: toDetail(row, await sourceProjectTitle(session.userId, row.sourceProjectId)),
    });
  } catch (error) {
    console.error("Portfolio inquiry update error:", error);
    return NextResponse.json({ success: false, message: "Could not update this enquiry." }, { status: 500 });
  }
}
