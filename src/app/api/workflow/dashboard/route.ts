import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { mergePortfolioContent } from "@/utils/portfolio";
import { normalizeCurrency } from "@/lib/currency";
import { convertFromSnapshot, getExchangeRateSnapshot } from "@/utils/exchangeRates";
import { buildActivationPlan } from "@/lib/activation-plan";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { normalizeActivationGoal } from "@/lib/activation";

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
      clientsWithPaidInvoices,
      recentClients,
      recentProjects,
      recentInvoices,
      recentExpenses
    ] = await Promise.all([
      // Revenue aggregations
      prisma.invoice.groupBy({
        by: ["status", "currency"],
        where: { userId },
        _sum: { total: true }
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
      // Top clients by revenue
      prisma.client.findMany({
        where: { userId },
        include: {
          invoices: {
            where: { status: "paid" },
            select: { total: true, currency: true }
          }
        }
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

    // Compute revenue stats
    let totalPaid = 0;
    let totalPending = 0;
    invoicesAggregate.forEach((grp) => {
      const sum = convertAmount(Number(grp._sum.total || 0), grp.currency);
      if (grp.status === "paid") {
        totalPaid += sum;
      } else if (grp.status === "sent" || grp.status === "viewed") {
        totalPending += sum;
      }
    });

    const totalExpenses = expensesAggregate.reduce((sum, group) => sum + convertAmount(Number(group._sum.amount || 0), group.currency), 0);
    const netEarnings = totalPaid - totalExpenses;

    // Format top clients and sort by revenue
    const topClients = clientsWithPaidInvoices
      .map((c) => {
        const total_revenue = c.invoices.reduce((sum, inv) => sum + convertAmount(Number(inv.total), inv.currency), 0);
        return {
          id: c.id,
          name: c.name,
          company: c.company,
          avatar_color: c.avatarColor,
          total_revenue: total_revenue.toString()
        };
      })
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
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    
    // Fetch recent 6 months data for charts
    const [recent6mInvoices, recent6mExpenses] = await Promise.all([
      prisma.invoice.findMany({
        where: { userId, issueDate: { gte: sixMonthsAgo }, status: "paid" },
        select: { total: true, currency: true, issueDate: true }
      }),
      prisma.expense.findMany({
        where: { userId, date: { gte: sixMonthsAgo } },
        select: { amount: true, currency: true, date: true }
      })
    ]);

    const monthlyChartData: Record<string, { month: string, revenue: number, expenses: number }> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyChartData[key] = { month: `${monthNames[d.getMonth()]}`, revenue: 0, expenses: 0 };
    }

    recent6mInvoices.forEach((inv) => {
      const d = new Date(inv.issueDate);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthlyChartData[key]) monthlyChartData[key].revenue += convertAmount(Number(inv.total), inv.currency);
    });

    recent6mExpenses.forEach((exp) => {
      const d = new Date(exp.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
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
      overdueInvoices,
      upcomingProjects,
      expenseCategories,
      workspaceUser,
      calendarConnectionCount,
      portfolio,
      legacyImportIssues,
      projectDeadlineCount,
      sentInvoiceCount,
      importJobCount,
      migrationsNeedingReview,
    ] = await Promise.all([
      prisma.client.count({ where: { userId } }),
      prisma.project.count({ where: { userId } }),
      prisma.invoice.count({ where: { userId } }),
      prisma.expense.count({ where: { userId } }),
      prisma.invoice.findMany({
        where: { userId, dueDate: { lt: now }, status: { in: ["sent", "viewed", "overdue"] } },
        select: { total: true, currency: true },
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
      prisma.importIssue.count({
        where: { importJob: { userId }, resolvedAt: null, severity: { in: ["warning", "blocking"] } },
      }),
      prisma.project.count({ where: { userId, dueDate: { not: null } } }),
      prisma.invoice.count({ where: { userId, status: { in: ["sent", "viewed", "overdue", "paid"] } } }),
      prisma.importJob.count({ where: { userId } }),
      // The migration engine records outstanding questions on the job itself
      // rather than as ImportIssue rows, so activation counts both.
      prisma.importJob.count({ where: { userId, engineVersion: 2, status: "review_required" } }),
    ]);

    const unresolvedImportIssues = legacyImportIssues + migrationsNeedingReview;

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
      { id: "identity", label: "Identity", complete: Boolean(workspaceUser?.name && workspaceUser.profession && businessTypes.length > 0), href: "/onboarding?restart=1" },
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
      unresolvedImportIssues,
      // The migration engine owns the import journey once it is switched on, so
      // activation points at it rather than the original onboarding importer.
      migrationHref: migrationEngineAvailable() ? "/migrate" : undefined,
    });

    const expenseCategoryTotals = new Map<string, number>();
    for (const group of expenseCategories) {
      expenseCategoryTotals.set(group.category, (expenseCategoryTotals.get(group.category) || 0) + convertAmount(Number(group._sum.amount || 0), group.currency));
    }
    const topExpenseCategory = [...expenseCategoryTotals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + convertAmount(Number(invoice.total), invoice.currency), 0);

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
        overdueCount: overdueInvoices.length,
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
