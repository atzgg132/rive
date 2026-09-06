import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { mergePortfolioContent } from "@/utils/portfolio";
import { normalizeCurrency } from "@/lib/currency";
import { convertFromSnapshot, getExchangeRateSnapshot } from "@/utils/exchangeRates";
import { buildActivationPlan } from "@/lib/activation-plan";
import { normalizeActivationGoal } from "@/lib/activation";
import { normalizeGuideProgress } from "@/lib/guides";
import { ISSUED_STATUSES, OPEN_STATUSES, collectedAmount, isIssuedStatus, outstandingAmount } from "@/utils/invoiceTotals";

/* Cash-reporting helpers (MONEY-03). The overview trend is cash received, so
   it buckets actual `InvoicePayment.amount` rows by `paidAt` in the owner's
   calendar — never invoice totals by settlement date. Legacy collections that
   exist only as `amountPaid` without receipt rows, and receipt totals that
   exceed `amountPaid`, are reported explicitly instead of being netted. */
const REPORT_PAGE_SIZE = 1_000;

function reportTimeZoneFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    calendar: "iso8601",
    numberingSystem: "latn",
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function normalizeReportTimeZone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "UTC";
  try {
    reportTimeZoneFormatter(value).format();
    return value;
  } catch {
    return "UTC";
  }
}

/** `YYYY-MM` for a timestamp in the reporting timezone. */
function monthKeyInTimeZone(value: Date | string, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid financial timestamp.");
  const parts = Object.fromEntries(reportTimeZoneFormatter(timeZone).formatToParts(date).map((part) => [part.type, part.value]));
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}`;
}

const REPORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic month label, independent of the server locale. */
function reportingMonthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const index = Number(match[2]) - 1;
  return index >= 0 && index < 12 ? `${REPORT_MONTH_NAMES[index]} ${match[1]}` : month;
}

function shiftReportMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Local midnight of a calendar day as an instant, resolved by iteration. */
function reportDayToInstant(year: number, month: number, day: number, timeZone: string): Date {
  const targetUtc = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-US", {
    calendar: "iso8601",
    numberingSystem: "latn",
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  let candidate = targetUtc;
  for (let index = 0; index < 4; index += 1) {
    const local = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]));
    const localAsUtc = Date.UTC(
      Number(local.year), Number(local.month) - 1, Number(local.day),
      Number(local.hour), Number(local.minute), Number(local.second),
    );
    candidate += targetUtc - localAsUtc;
  }
  return new Date(candidate);
}

/** The current six-month window in the owner's calendar, with instant bounds. */
function reportingWindow(now: Date, timeZone: string, monthCount = 6) {
  const normalized = normalizeReportTimeZone(timeZone);
  const currentMonth = monthKeyInTimeZone(now, normalized);
  const firstMonth = shiftReportMonth(currentMonth, -(monthCount - 1));
  const [startYear, startMonth] = firstMonth.split("-").map(Number);
  const nextMonth = shiftReportMonth(currentMonth, 1);
  const [endYear, endMonth] = nextMonth.split("-").map(Number);
  const months = Array.from({ length: monthCount }, (_, index) => {
    const month = shiftReportMonth(firstMonth, index);
    return { month, label: reportingMonthLabel(month) };
  });
  return {
    timeZone: normalized,
    start: reportDayToInstant(startYear, startMonth, 1, normalized),
    endExclusive: reportDayToInstant(endYear, endMonth, 1, normalized),
    months,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const userId = session.userId;
    const [currencyOwner, exchangeRates] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { displayCurrency: true, timeZone: true, name: true, profession: true, businessType: true, businessTypes: true, onboardingData: true } }),
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
      paymentReconciliationByCurrency,
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
      // Legacy collections recorded only as `amountPaid` without receipt rows,
      // and receipt rows totalling more than `amountPaid`, are surfaced as
      // explicit reconciliation gaps — never silently netted into the chart.
      // One grouped query keeps this bounded regardless of invoice volume.
      prisma.$queryRaw<Array<{ currency: string; collections_without_payment_date: Prisma.Decimal; payment_reconciliation_excess: Prisma.Decimal }>>(Prisma.sql`
        SELECT i.currency,
          COALESCE(SUM(CASE
            WHEN i.status IN ('sent', 'viewed', 'overdue', 'partially_paid', 'paid')
              AND i.amount_paid > COALESCE(p.payment_total, 0)
            THEN i.amount_paid - COALESCE(p.payment_total, 0)
            ELSE 0
          END), 0) AS collections_without_payment_date,
          COALESCE(SUM(CASE
            WHEN i.status IN ('sent', 'viewed', 'overdue', 'partially_paid', 'paid')
              AND COALESCE(p.payment_total, 0) > i.amount_paid
            THEN COALESCE(p.payment_total, 0) - i.amount_paid
            ELSE 0
          END), 0) AS payment_reconciliation_excess
        FROM invoices i
        LEFT JOIN (
          SELECT invoice_id, SUM(amount) AS payment_total
          FROM invoice_payments
          GROUP BY invoice_id
        ) p ON p.invoice_id = i.id
        WHERE i.user_id = ${userId}
        GROUP BY i.currency
      `),
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
      // Aggregate collected amounts for every issued invoice instead of
      // loading every invoice into the dashboard request. Client display
      // fields are fetched below only for the clients represented by these
      // compact groups. Partially paid work counts at what is banked, so the
      // ranking agrees with the collected tile above it.
      prisma.invoice.groupBy({
        by: ["clientId", "currency"],
        where: { userId, status: { in: [...ISSUED_STATUSES] }, clientId: { not: null } },
        _sum: { total: true, amountPaid: true },
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
    const revenueByClient = new Map<string, Array<{ currency: string; total: number; amountPaid: number }>>();
    for (const row of paidRevenueByClient) {
      if (!row.clientId) continue;
      const entries = revenueByClient.get(row.clientId) || [];
      entries.push({
        currency: row.currency,
        total: Number(row._sum.total || 0),
        amountPaid: Number(row._sum.amountPaid || 0),
      });
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
        total_revenue: (revenueByClient.get(client.id) || []).reduce(
          (sum, group) => sum + convertAmount(collectedAmount(group.total, group.amountPaid), group.currency),
          0,
        ).toString(),
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

    // The overview trend is cash received. Invoice totals belong to the issue
    // cohort; a settled 1,000 invoice may have 400 received in August and 600
    // in September. Receipt rows are read by their paidAt timestamp and
    // bucketed in the owner's calendar, so split-month collections — including
    // partials recorded before settlement — land in their actual months.
    const chartNow = new Date();
    const reporting = reportingWindow(chartNow, currencyOwner?.timeZone || "UTC", 6);
    const monthlyChartData: Record<string, { month: string, period: string, revenue: number, expenses: number }> = Object.fromEntries(
      reporting.months.map(({ month, label }) => [month, { month: label, period: month, revenue: 0, expenses: 0 }]),
    );

    // Bounded keyset walk: only the current page is ever held in memory.
    let paymentCursor: string | undefined;
    while (true) {
      const paymentRows = await prisma.invoicePayment.findMany({
        where: {
          id: paymentCursor ? { gt: paymentCursor } : undefined,
          paidAt: { gte: reporting.start, lt: reporting.endExclusive },
          invoice: { userId, status: { in: [...ISSUED_STATUSES] } },
        },
        select: { id: true, amount: true, paidAt: true, invoice: { select: { currency: true } } },
        orderBy: { id: "asc" },
        take: REPORT_PAGE_SIZE,
      });
      for (const payment of paymentRows) {
        const month = monthKeyInTimeZone(payment.paidAt, reporting.timeZone);
        if (monthlyChartData[month]) {
          monthlyChartData[month].revenue += convertAmount(Number(payment.amount), payment.invoice.currency);
        }
      }
      if (paymentRows.length < REPORT_PAGE_SIZE) break;
      const nextPaymentCursor = paymentRows[paymentRows.length - 1]?.id;
      if (!nextPaymentCursor || nextPaymentCursor === paymentCursor) break;
      paymentCursor = nextPaymentCursor;
    }

    let expenseCursor: string | undefined;
    while (true) {
      const expenseRows = await prisma.expense.findMany({
        where: {
          id: expenseCursor ? { gt: expenseCursor } : undefined,
          userId,
          date: { gte: reporting.start, lt: reporting.endExclusive },
        },
        select: { id: true, amount: true, currency: true, date: true },
        orderBy: { id: "asc" },
        take: REPORT_PAGE_SIZE,
      });
      for (const expense of expenseRows) {
        const month = monthKeyInTimeZone(expense.date, reporting.timeZone);
        if (monthlyChartData[month]) {
          monthlyChartData[month].expenses += convertAmount(Number(expense.amount), expense.currency);
        }
      }
      if (expenseRows.length < REPORT_PAGE_SIZE) break;
      const nextExpenseCursor = expenseRows[expenseRows.length - 1]?.id;
      if (!nextExpenseCursor || nextExpenseCursor === expenseCursor) break;
      expenseCursor = nextExpenseCursor;
    }

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
    const financialIntegrity = paymentReconciliationByCurrency.map((row) => ({
      currency: row.currency.toUpperCase(),
      collectionsWithoutPaymentDate: Number(row.collections_without_payment_date || 0),
      paymentReconciliationExcess: Number(row.payment_reconciliation_excess || 0),
    })).filter((row) => row.collectionsWithoutPaymentDate > 0 || row.paymentReconciliationExcess > 0);

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
      chartDefinition: {
        metric: "cash_received",
        source: "InvoicePayment.amount",
        dateField: "paidAt",
        timeZone: reporting.timeZone,
        startMonth: reporting.months[0]?.month || null,
        endMonth: reporting.months.at(-1)?.month || null,
      },
      financialIntegrity,
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
