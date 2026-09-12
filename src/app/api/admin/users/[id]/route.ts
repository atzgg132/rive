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
