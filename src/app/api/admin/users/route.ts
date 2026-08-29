import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { hasAdminSession } from "@/utils/adminSession";
import { funnelSummaryForUser, loadWorkspaceSlices } from "@/utils/adminFunnelFacts";

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

export async function GET(req: NextRequest) {
  if (!await hasAdminSession(req)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const page = Math.max(Number.parseInt(params.get("page") || "1", 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(params.get("pageSize") || "25", 10) || 25, 1), 50);
  const search = (params.get("search") || "").trim();
  const where = { accountType: "customer", ...(search ? { OR: [{ email: { contains: search, mode: "insensitive" as const } }, { name: { contains: search, mode: "insensitive" as const } }] } : {}) };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, email: true, name: true, createdAt: true, accountType: true, emailVerifiedAt: true, emailVerificationRequiredAt: true, onboardingStatus: true, businessType: true, profession: true, onboardingData: true, attribution: { select: { firstTouchSource: true, lastTouchSource: true, firstTouchMedium: true, firstTouchCampaign: true, referralSource: true } } } }),
  ]);
  const slices = await loadWorkspaceSlices(users.map((user) => user.id));
  const lastEvents = await Promise.all(users.map((user) => prisma.productEvent.findFirst({ where: { userId: user.id }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true, eventName: true, module: true } })));
  const data = users.map((user, index) => {
    const lastEvent = lastEvents[index];
    const funnel = funnelSummaryForUser(user, slices.get(user.id) || { clients: [], projects: [], invoices: [], expenses: [], calendarEvents: [], importJobs: [], portfolios: [] });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      accountType: user.accountType,
      emailVerified: Boolean(user.emailVerifiedAt || !user.emailVerificationRequiredAt),
      onboardingStatus: user.onboardingStatus,
      businessType: user.businessType,
      profession: user.profession,
      goal: isRecord(user.onboardingData) && typeof user.onboardingData.goal === "string" ? user.onboardingData.goal : null,
      startingPath: isRecord(user.onboardingData) && typeof user.onboardingData.startingPath === "string" ? user.onboardingData.startingPath : null,
      qualified: funnel.qualified,
      activated: funnel.activated,
      stage: funnel.stage,
      realData: funnel.realData,
      qualificationBlockers: funnel.qualificationBlockers,
      activationPaths: funnel.activationPaths,
      attribution: user.attribution,
      lastActivity: lastEvent ? { at: lastEvent.occurredAt, eventName: lastEvent.eventName, module: lastEvent.module } : null,
    };
  });
  return NextResponse.json({ success: true, page, pageSize, total, data });
}
