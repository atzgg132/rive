import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { hasAdminSession } from "@/utils/adminSession";
import { isQualifiedUser, REAL_DATA_EVENT_NAMES, REAL_DATA_ORIGINS } from "@/utils/funnelDefinitions";

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
  const data = await Promise.all(users.map(async (user) => {
    const [lastEvent, realDataCount] = await Promise.all([
      prisma.productEvent.findFirst({ where: { userId: user.id }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true, eventName: true, module: true } }),
      prisma.productEvent.count({ where: { userId: user.id, dataOrigin: { in: Array.from(REAL_DATA_ORIGINS) }, eventName: { in: Array.from(REAL_DATA_EVENT_NAMES) } } }),
    ]);
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt, accountType: user.accountType, emailVerified: Boolean(user.emailVerifiedAt || !user.emailVerificationRequiredAt), onboardingStatus: user.onboardingStatus, businessType: user.businessType, profession: user.profession, goal: isRecord(user.onboardingData) && typeof user.onboardingData.goal === "string" ? user.onboardingData.goal : null, startingPath: isRecord(user.onboardingData) && typeof user.onboardingData.startingPath === "string" ? user.onboardingData.startingPath : null, qualified: isQualifiedUser(user), attribution: user.attribution, realData: realDataCount > 0, lastActivity: lastEvent ? { at: lastEvent.occurredAt, eventName: lastEvent.eventName, module: lastEvent.module } : null };
  }));
  return NextResponse.json({ success: true, page, pageSize, total, data });
}
