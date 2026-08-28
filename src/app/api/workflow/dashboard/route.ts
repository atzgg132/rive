import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { mergePortfolioContent } from "@/utils/portfolio";
import { normalizeCurrency } from "@/lib/currency";
import { convertFromSnapshot, getExchangeRateSnapshot } from "@/utils/exchangeRates";
import { buildActivationPlan } from "@/lib/activation-plan";
import { normalizeActivationGoal } from "@/lib/activation";
import { normalizeGuideProgress } from "@/lib/guides";
import { OPEN_STATUSES, collectedAmount, isIssuedStatus, outstandingAmount } from "@/utils/invoiceTotals";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const userId = session.userId;
    const [currencyOwner, exchangeRates] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { displayCurrency: true, name: true, profession: true, businessType: true, businessTypes: true, onboardingData: true } }),
      getExchangeRateSnapshot(),
    ]);
    const displayCurrency = normalizeCurrency(currencyOwner?.displayCurrency);
    let financialsAvailable = true;
    const convertAmount = (amount: number, currency: string) => {
      const converted = convertFromSnapshot(amount, currency, displayCurrency, exchangeRates);
      if (converted === null) {
        financialsAvailable = false;
        return 0;
      }
      return converted;
    };

    // Run aggregations in parallel
    const [
      invoicesAggregate,
      activeProjectsCount,
      expensesAggregate,
      paidRevenueByClient,
      recentClients,
      recentProjects,
      recentInvoices,
      recentExpenses
    ] = await Promise.all([
      // Revenue aggregations
      prisma.invoice.groupBy({
        by: ["status", "currency"],
        where: { userId },
        _sum: { total: true, amountPaid: true }
      }),
      // Active Projects Count
      prisma.project.count({
        where: { userId, status: "active" }
      }),
      // Total Expenses
      prisma.expense.groupBy({
        by: ["currency"],
        where: { userId },
        _sum: { amount: true }
      }),
      // Aggregate paid invoice totals instead of loading every paid invoice
      // into the dashboard request. Client display fields are fetched below
      // only for the clients represented by these compact groups.
      prisma.invoice.groupBy({
        by: ["clientId", "currency"],
        where: { userId, status: "paid", clientId: { not: null } },
        _sum: { total: true },
      }),
      // Recent clients
      prisma.client.findMany({
        where: { userId },
        select: { name: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      // Recent projects
      prisma.project.findMany({
        where: { userId },
        select: { title: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      // Recent invoices
      prisma.invoice.findMany({
        where: { userId },
        select: { invoiceNumber: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      // Recent expenses
      prisma.expense.findMany({
        where: { userId },
        select: { description: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    ]);

    // Cash in hand and money still owed, split the way the revenue workspace
    // splits them. Keying off status alone counted a partly paid invoice at its
    // gross value in one bucket and left it out of the other entirely, and it
    // dropped `partially_paid` invoices that were not yet past due from both.
    let totalPaid = 0;
    let totalPending = 0;
    invoicesAggregate.forEach((grp) => {
      if (!isIssuedStatus(grp.status)) return;
      const gross = Number(grp._sum.total || 0);
      const paid = Number(grp._sum.amountPaid || 0);
      totalPaid += convertAmount(collectedAmount(gross, paid), grp.currency);
      totalPending += convertAmount(outstandingAmount(gross, paid), grp.currency);
    });

    const totalExpenses = expensesAggregate.reduce((sum, group) => sum + convertAmount(Number(group._sum.amount || 0), group.currency), 0);
    const netEarnings = totalPaid - totalExpenses;

    const clientIds = [...new Set(paidRevenueByClient.map((row) => row.clientId).filter((id): id is string => Boolean(id)))];
    const clientRecords = clientIds.length
      ? await prisma.client.findMany({
          where: { userId, id: { in: clientIds } },
          select: { id: true, name: true, company: true, avatarColor: true },
        })
      : [];
    const revenueByClient = new Map<string, Array<{ currency: string; total: number }>>();
    for (const row of paidRevenueByClient) {
      if (!row.clientId) continue;
      const entries = revenueByClient.get(row.clientId) || [];
      entries.push({ currency: row.currency, total: Number(row._sum.total || 0) });
      revenueByClient.set(row.clientId, entries);
    }

    // Format top clients and sort by revenue after applying the workspace's
    // exchange-rate snapshot to each currency group.
    const topClients = clientRecords
      .map((client) => ({
        id: client.id,
        name: client.name,
        company: client.company,
        avatar_color: client.avatarColor,
        total_revenue: (revenueByClient.get(client.id) || []).reduce((sum, group) => sum + convertAmount(group.total, group.currency), 0).toString(),
      }))
      .filter((c) => Number(c.total_revenue) > 0)
      .sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))
      .slice(0, 5);

    // Combine and sort recent activity stream in memory
    const activities: { type: string; title: string; created_at: string; rawDate: Date }[] = [];
    
    recentClients.forEach((c) => {
      activities.push({ type: "client_added", title: c.name, created_at: c.createdAt.toISOString(), rawDate: c.createdAt });
    });
    recentProjects.forEach((p) => {
      activities.push({ type: "project_created", title: p.title, created_at: p.createdAt.toISOString(), rawDate: p.createdAt });
    });
    recentInvoices.forEach((i) => {
      activities.push({ type: "invoice_created", title: `invoice #${i.invoiceNumber}`, created_at: i.createdAt.toISOString(), rawDate: i.createdAt });
    });
    recentExpenses.forEach((e) => {
      activities.push({ type: "expense_logged", title: e.description, created_at: e.createdAt.toISOString(), rawDate: e.createdAt });
    });

    const recentActivity = activities
      .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
      .slice(0, 10)
      .map(({ type, title, created_at }) => ({ type, title, created_at }));

    // Compute time-series data for charts (last 6 months)
    const chartNow = new Date();
    const sixMonthsAgo = new Date(Date.UTC(chartNow.getUTCFullYear(), chartNow.getUTCMonth() - 5, 1));
    
    // Fetch recent 6 months data for charts
    const [recent6mInvoices, recent6mExpenses] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          userId,
          status: "paid",
          OR: [
            { paidDate: { gte: sixMonthsAgo } },
            { paidDate: null, issueDate: { gte: sixMonthsAgo } },
          ],
        },
        select: { total: true, currency: true, issueDate: true, paidDate: true }
      }),
      prisma.expense.findMany({
        where: { userId, date: { gte: sixMonthsAgo } },
        select: { amount: true, currency: true, date: true }
      })
    ]);

    const monthlyChartData: Record<string, { month: string, period: string, revenue: number, expenses: number }> = {};
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(chartNow.getUTCFullYear(), chartNow.getUTCMonth() - i, 1));
      const key = d.toISOString().slice(0, 7);
      monthlyChartData[key] = {
        month: d.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" }),
        period: key,
        revenue: 0,
        expenses: 0,
      };
    }

    recent6mInvoices.forEach((inv) => {
      const d = inv.paidDate || inv.issueDate;
      const key = d.toISOString().slice(0, 7);
      if (monthlyChartData[key]) monthlyChartData[key].revenue += convertAmount(Number(inv.total), inv.currency);
    });

    recent6mExpenses.forEach((exp) => {
      const key = exp.date.toISOString().slice(0, 7);
      if (monthlyChartData[key]) monthlyChartData[key].expenses += convertAmount(Number(exp.amount), exp.currency);
    });

    const now = new Date();
    const upcomingCutoff = new Date(now);
    upcomingCutoff.setDate(upcomingCutoff.getDate() + 14);
    const [
      clientCount,
      projectCount,
      invoiceCount,
      expenseCount,
      overdueInvoiceGroups,
      upcomingProjects,
      expenseCategories,
      workspaceUser,
      calendarConnectionCount,
      portfolio,
      projectDeadlineCount,
      sentInvoiceCount,
      importJobCount,
      completedImportJobCount,
      activeImportJobCount,
      migrationsNeedingReview,
      latestResumableMigration,
    ] = await Promise.all([
      prisma.client.count({ where: { userId } }),
      prisma.project.count({ where: { userId } }),
      prisma.invoice.count({ where: { userId } }),
      prisma.expense.count({ where: { userId } }),
      prisma.invoice.groupBy({
        by: ["currency"],
        where: { userId, dueDate: { lt: now }, status: { in: [...OPEN_STATUSES] } },
        _sum: { total: true, amountPaid: true },
        _count: { _all: true },
      }),
      prisma.project.findMany({
        where: { userId, dueDate: { gte: now, lte: upcomingCutoff }, status: { notIn: ["completed", "cancelled"] } },
        select: { id: true, title: true, dueDate: true },
        orderBy: { dueDate: "asc" },
        take: 3,
      }),
      prisma.expense.groupBy({
        by: ["category", "currency"],
        where: { userId },
        _sum: { amount: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, profession: true, businessType: true, businessTypes: true, onboardingStatus: true, onboardingData: true },
      }),
      prisma.calendarConnection.count({ where: { userId, status: "connected" } }),
      prisma.portfolio.findUnique({ where: { userId }, select: { id: true, status: true, publishedAt: true, content: true } }),
      prisma.project.count({ where: { userId, dueDate: { not: null } } }),
      prisma.invoice.count({ where: { userId, status: { in: ["sent", "viewed", "overdue", "partially_paid", "paid"] } } }),
      prisma.importJob.count({ where: { userId, engineVersion: 2 } }),
      prisma.importJob.count({
        where: {
          userId,
          engineVersion: 2,
          status: { in: ["completed", "completed_with_issues"] },
          OR: [{ createdRecords: { gt: 0 } }, { updatedRecords: { gt: 0 } }],
        },
      }),
      prisma.importJob.count({
        where: {
          userId,
          engineVersion: 2,
          status: { in: ["created", "uploading", "profiling", "mapping", "review_required", "ready", "failed", "committing"] },
        },
      }),
      prisma.importJob.aggregate({
        where: { userId, engineVersion: 2, status: "review_required" },
        _sum: { unresolvedCount: true },
      }),
      prisma.importJob.findFirst({
        where: {
          userId,
          engineVersion: 2,
          status: { in: ["created", "uploading", "profiling", "mapping", "review_required", "ready", "failed", "committing"] },
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      }),
    ]);

    const unresolvedImportIssues = migrationsNeedingReview._sum.unresolvedCount || 0;

    const receivableBase = totalPaid + totalPending;
    const collectionRate = receivableBase > 0 ? Math.round((totalPaid / receivableBase) * 100) : 0;
    const profitMargin = totalPaid > 0 ? Math.round((netEarnings / totalPaid) * 100) : 0;
    const portfolioContent = portfolio ? mergePortfolioContent(portfolio.content) : null;
    const businessTypes = workspaceUser?.businessTypes?.length
      ? workspaceUser.businessTypes
      : workspaceUser?.businessType
        ? [workspaceUser.businessType]
        : [];
    const profileSignals = [
      // Completed users should stay in the dashboard-owned portfolio studio;
      // onboarding is only for incomplete account setup and must not be a
      // destination for a normal workspace task.
      { id: "identity", label: "Identity", complete: Boolean(workspaceUser?.name && workspaceUser.profession && businessTypes.length > 0), href: "/portfolio" },
      { id: "story", label: "Headline & introduction", complete: Boolean(portfolioContent?.headline.trim() && portfolioContent.bio.trim()), href: "/portfolio" },
      { id: "service", label: "At least one service", complete: Boolean(portfolioContent?.services.some((service) => service.title.trim())), href: "/portfolio" },
      { id: "work", label: "At least one selected project", complete: Boolean(portfolioContent?.projects.some((project) => project.visibility !== "private" && project.title.trim())), href: "/portfolio" },
      { id: "contact", label: "Contact details", complete: Boolean(portfolioContent?.contactEmail.trim() || portfolioContent?.location.trim()), href: "/portfolio" },
      { id: "published", label: "Portfolio published", complete: portfolio?.status === "published" || Boolean(portfolio?.publishedAt), href: "/portfolio" },
    ];
    const profileCoreCompleted = profileSignals.slice(0, 5).filter((signal) => signal.complete).length;
    const profileReadiness = {
      completed: profileSignals.filter((signal) => signal.complete).length,
      total: profileSignals.length,
      percentage: Math.round((profileSignals.filter((signal) => signal.complete).length / profileSignals.length) * 100),
      substantial: profileCoreCompleted >= 4,
      signals: profileSignals,
    };
    const rawOnboardingData = workspaceUser?.onboardingData ?? currencyOwner?.onboardingData;
    const onboardingData = rawOnboardingData && typeof rawOnboardingData === "object" && !Array.isArray(rawOnboardingData)
      ? rawOnboardingData as Record<string, unknown>
      : {};
    const isLegacyCompletedUser = workspaceUser?.onboardingStatus === "complete" &&
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
      profileReady: profileReadiness.substantial,
      selectedPortfolioProject: Boolean(portfolioContent?.projects.some((project) => project.visibility !== "private" && project.title.trim())),
      publishedPortfolio: portfolio?.status === "published" || Boolean(portfolio?.publishedAt),
      projectDeadlineCount,
      sentInvoiceCount,
      calendarConnectionCount,
      importJobCount,
      completedImportJobCount,
      activeImportJobCount,
      unresolvedImportIssues,
      // Resume an unfinished session when one exists; never create a second
      // import flow or fall back to onboarding for a dashboard user.
      migrationHref: latestResumableMigration ? `/migrate?id=${encodeURIComponent(latestResumableMigration.id)}` : "/migrate",
      migrationReviewHref: latestResumableMigration ? `/migrate?id=${encodeURIComponent(latestResumableMigration.id)}` : "/migrate",
      guideProgress: normalizeGuideProgress((workspaceUser?.onboardingData as Record<string, unknown> | null)?.guideProgress),
    });

    const expenseCategoryTotals = new Map<string, number>();
    for (const group of expenseCategories) {
      expenseCategoryTotals.set(group.category, (expenseCategoryTotals.get(group.category) || 0) + convertAmount(Number(group._sum.amount || 0), group.currency));
    }
    const topExpenseCategory = [...expenseCategoryTotals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    const overdueCount = overdueInvoiceGroups.reduce((sum, group) => sum + group._count._all, 0);
    const overdueAmount = overdueInvoiceGroups.reduce(
      (sum, group) => sum + convertAmount(outstandingAmount(Number(group._sum.total || 0), Number(group._sum.amountPaid || 0)), group.currency),
      0,
    );

    return NextResponse.json({
      success: true,
      currency: {
        displayCurrency,
        ratesAsOf: exchangeRates?.asOf || null,
        conversionAvailable: financialsAvailable,
      },
      stats: {
        totalPaid,
        totalPending,
        activeProjects: activeProjectsCount,
        totalExpenses,
        netEarnings
      },
      topClients,
      recentActivity,
      chartData: Object.values(monthlyChartData),
      activation,
      profileReadiness,
      insights: {
        collectionRate,
        profitMargin,
        overdueCount,
        overdueAmount,
        topExpenseCategory: topExpenseCategory?.[0] || null,
        topExpenseAmount: topExpenseCategory?.[1] || 0,
        upcomingProjects: upcomingProjects.map((project) => ({
          id: project.id,
          title: project.title,
          dueDate: project.dueDate?.toISOString() || null,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Dashboard analytics error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
