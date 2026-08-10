import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { mergePortfolioContent } from "@/utils/portfolio";
import { buildActivationPlan } from "@/lib/activation-plan";
import { normalizeActivationGoal } from "@/lib/activation";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const [user, clientCount, projectCount, invoiceCount, expenseCount, projectDeadlineCount, sentInvoiceCount, calendarConnectionCount, importJobCount, unresolvedImportIssues, portfolio] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, profession: true, businessType: true, businessTypes: true, onboardingStatus: true, onboardingData: true },
    }),
    prisma.client.count({ where: { userId: session.userId } }),
    prisma.project.count({ where: { userId: session.userId } }),
    prisma.invoice.count({ where: { userId: session.userId } }),
    prisma.expense.count({ where: { userId: session.userId } }),
    prisma.project.count({ where: { userId: session.userId, dueDate: { not: null } } }),
    prisma.invoice.count({ where: { userId: session.userId, status: { in: ["sent", "viewed", "overdue", "paid"] } } }),
    prisma.calendarConnection.count({ where: { userId: session.userId, status: "connected" } }),
    prisma.importJob.count({ where: { userId: session.userId } }),
    prisma.importIssue.count({ where: { importJob: { userId: session.userId }, resolvedAt: null, severity: { in: ["warning", "blocking"] } } }),
    prisma.portfolio.findUnique({ where: { userId: session.userId }, select: { status: true, publishedAt: true, content: true } }),
  ]);

  if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });

  const portfolioContent = portfolio ? mergePortfolioContent(portfolio.content) : null;
  const businessTypes = user.businessTypes?.length ? user.businessTypes : user.businessType ? [user.businessType] : [];
  const profileSignals = [
    Boolean(user.name && user.profession && businessTypes.length > 0),
    Boolean(portfolioContent?.headline.trim() && portfolioContent.bio.trim()),
    Boolean(portfolioContent?.services.some((service) => service.title.trim())),
    Boolean(portfolioContent?.projects.some((project) => project.visibility !== "private" && project.title.trim())),
    Boolean(portfolioContent?.contactEmail.trim() || portfolioContent?.location.trim()),
  ];
  const profileReady = profileSignals.filter(Boolean).length >= 4;
  const onboardingData = user.onboardingData && typeof user.onboardingData === "object" && !Array.isArray(user.onboardingData)
    ? user.onboardingData as Record<string, unknown>
    : {};
  const isLegacyCompletedUser = user.onboardingStatus === "complete" &&
    typeof onboardingData.goal !== "string" &&
    typeof onboardingData.startingPath !== "string" &&
    onboardingData.guidanceDismissed !== true;
  const requestedGoal = new URL(req.url).searchParams.get("goal");
  const goal = requestedGoal ? normalizeActivationGoal(requestedGoal) : onboardingData.goal;

  const activation = buildActivationPlan({
    goal,
    startingPath: onboardingData.startingPath,
    guidanceDismissed: onboardingData.guidanceDismissed === true || isLegacyCompletedUser,
    guidanceCompleted: onboardingData.guidanceCompleted === true,
    counts: { clients: clientCount, projects: projectCount, invoices: invoiceCount, expenses: expenseCount },
    profileReady,
    selectedPortfolioProject: Boolean(portfolioContent?.projects.some((project) => project.visibility !== "private" && project.title.trim())),
    publishedPortfolio: portfolio?.status === "published" || Boolean(portfolio?.publishedAt),
    projectDeadlineCount,
    sentInvoiceCount,
    calendarConnectionCount,
    importJobCount,
    unresolvedImportIssues,
  });

  return NextResponse.json({ success: true, activation });
}
