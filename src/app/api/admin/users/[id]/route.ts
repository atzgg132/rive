import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { hasAdminSession } from "@/utils/adminSession";
import { funnelSummaryForUser, loadWorkspaceSlices } from "@/utils/adminFunnelFacts";
import { DEEP_ACTIVATION_WINDOW_DAYS } from "@/utils/funnelDefinitions";
import { getRequestIp } from "@/utils/rateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { buildActivationPlan } from "@/lib/activation-plan";
import { mergePortfolioContent } from "@/utils/portfolio";
import { normalizeGuideProgress } from "@/lib/guides";
import { readJsonBody } from "@/utils/apiBoundary";
import { clearAdminMetricsCache } from "@/utils/adminMetrics";

// The admin can only move an account between these two. Test, e2e, demo and
// synthetic types belong to fixtures and seed scripts, so they stay read-only.
const ADMIN_SETTABLE_ACCOUNT_TYPES = new Set(["customer", "internal"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await hasAdminSession(req)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, createdAt: true, accountType: true, onboardingStatus: true, businessType: true, profession: true, onboardingData: true, attribution: true, emailVerifiedAt: true, emailVerificationRequiredAt: true } });
  if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

  // Reading a single customer's timeline is the sensitive admin read, so it is
  // audited like login and logout are. Fail-open: an audit write failure must
  // not block the diagnosis.
  await prisma.auditEvent.create({ data: { action: "admin.users.view", targetType: "user", targetId: id, ipHash: hashRequestValue(getRequestIp(req)) } }).catch((error) => console.warn("Admin access audit failed:", error));

  const deepWindowEnd = new Date(user.createdAt.getTime() + DEEP_ACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [events, deepEvents, audit, invoiceEvents, slices, clientCount, projectCount, invoiceCount, expenseCount, projectDeadlineCount, sentInvoiceCount, calendarConnectionCount, calendarConnections, publishedPortfolio] = await Promise.all([
    prisma.productEvent.findMany({ where: { userId: id }, orderBy: { occurredAt: "desc" }, take: 100 }),
    // Deep activation reads the same inputs as the Overview card: meaningful
    // product events inside the fourteen-day window after signup, scoped to
    // this environment exactly like the metrics cohort query.
    prisma.productEvent.findMany({
      where: { userId: id, environment: (process.env.APP_ENV || process.env.NODE_ENV || "local").toLowerCase(), occurredAt: { gte: user.createdAt, lte: deepWindowEnd } },
      orderBy: { occurredAt: "asc" },
      take: 1000,
      select: { eventName: true, module: true, occurredAt: true, properties: true },
    }),
    prisma.auditEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, action: true, targetType: true, targetId: true, metadata: true, createdAt: true } }),
    prisma.invoiceEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, invoiceId: true, eventType: true, metadata: true, createdAt: true } }),
    loadWorkspaceSlices([id]),
    prisma.client.count({ where: { userId: id } }),
    prisma.project.count({ where: { userId: id } }),
    prisma.invoice.count({ where: { userId: id } }),
    prisma.expense.count({ where: { userId: id } }),
    prisma.project.count({ where: { userId: id, dueDate: { not: null } } }),
    prisma.invoice.count({ where: { userId: id, status: { in: ["sent", "viewed", "overdue", "partially_paid", "paid"] } } }),
    prisma.calendarConnection.count({ where: { userId: id, status: "connected" } }),
    prisma.calendarConnection.findMany({
      where: { userId: id },
      select: { id: true, provider: true, accountEmail: true, status: true, lastSyncedAt: true, lastError: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.portfolio.findUnique({ where: { userId: id }, select: { status: true, publishedAt: true, content: true } }),
  ]);
  const slice = slices.get(id) || { clients: [], projects: [], invoices: [], expenses: [], calendarEvents: [], importJobs: [], portfolios: [] };
  const summary = funnelSummaryForUser(user, slice, deepEvents);
  const onboardingData = isRecord(user.onboardingData) ? user.onboardingData : {};
  const portfolioContent = publishedPortfolio ? mergePortfolioContent(publishedPortfolio.content) : null;
  const productGuidance = buildActivationPlan({
    goal: onboardingData.goal,
    startingPath: onboardingData.startingPath,
    guidanceDismissed: onboardingData.guidanceDismissed === true,
    guidanceCompleted: onboardingData.guidanceCompleted === true,
    counts: { clients: clientCount, projects: projectCount, invoices: invoiceCount, expenses: expenseCount },
    profileReady: Boolean(user.name && user.profession && user.businessType),
    selectedPortfolioProject: Boolean(portfolioContent?.projects.some((project) => project.visibility !== "private" && project.title.trim())),
    publishedPortfolio: publishedPortfolio?.status === "published" || Boolean(publishedPortfolio?.publishedAt),
    projectDeadlineCount,
    sentInvoiceCount,
    calendarConnectionCount,
    importJobCount: 0,
    unresolvedImportIssues: 0,
    guideProgress: normalizeGuideProgress(onboardingData.guideProgress),
  });
  const timeline = [
    ...events.map((event) => ({ id: event.id, kind: "product_event", type: event.eventName, module: event.module, at: event.occurredAt, metadata: event.properties })),
    ...audit.map((event) => ({ id: event.id, kind: "audit", type: event.action, module: event.targetType, at: event.createdAt, metadata: event.metadata })),
    ...invoiceEvents.map((event) => ({ id: event.id, kind: "invoice_event", type: event.eventType, module: "invoices", at: event.createdAt, metadata: { ...(event.metadata && typeof event.metadata === "object" ? event.metadata : {}), invoiceId: event.invoiceId } })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 200);
  return NextResponse.json({
    success: true,
    user,
    funnel: {
      stage: summary.stage,
      qualified: summary.qualified,
      activated: summary.activated,
      deeplyActivated: summary.deeplyActivated,
      deepActivation: summary.deepActivation,
      realData: summary.realData,
      productGuidanceStage: productGuidance.activationStage,
      qualificationBlockers: summary.qualificationBlockers,
      activation: {
        native: summary.activation.native,
        migration: summary.activation.migration,
        portfolio: summary.activation.portfolio,
        paths: summary.activationPaths,
        blockers: summary.activationBlockers,
      },
      workspace: summary.workspace,
    },
    timeline,
    calendarConnections,
  });
}

/**
 * Marks an account as internal (excluded from every admin metric) or back to a
 * customer. The change and its audit record commit together: an unaudited
 * reclassification would silently move the funnel numbers.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await hasAdminSession(req)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const accountType = typeof parsedBody.body?.accountType === "string" ? parsedBody.body.accountType : "";
  if (!ADMIN_SETTABLE_ACCOUNT_TYPES.has(accountType)) return NextResponse.json({ success: false, message: "Account type must be customer or internal." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, accountType: true } });
  if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
  if (!ADMIN_SETTABLE_ACCOUNT_TYPES.has(user.accountType)) {
    return NextResponse.json({ success: false, message: `This is a ${user.accountType} account and cannot be reclassified here.` }, { status: 409 });
  }
  if (user.accountType === accountType) return NextResponse.json({ success: true, accountType, changed: false });

  // The audit row keeps userId empty and names the account in targetId, like
  // admin.users.view: audit_events is unique on (user_id, action), so keying
  // it by user would refuse the second reclassification of the same account.
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { accountType } }),
    prisma.auditEvent.create({ data: { action: "admin.users.account_type", targetType: "user", targetId: id, metadata: { from: user.accountType, to: accountType }, ipHash: hashRequestValue(getRequestIp(req)) } }),
  ]);
  clearAdminMetricsCache();
  return NextResponse.json({ success: true, accountType, changed: true });
}
