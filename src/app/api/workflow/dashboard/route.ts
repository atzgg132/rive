import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const userId = session.userId;

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
        by: ["status"],
        where: { userId },
        _sum: { total: true }
      }),
      // Active Projects Count
      prisma.project.count({
        where: { userId, status: "active" }
      }),
      // Total Expenses
      prisma.expense.aggregate({
        where: { userId },
        _sum: { amount: true }
      }),
      // Top clients by revenue
      prisma.client.findMany({
        where: { userId },
        include: {
          invoices: {
            where: { status: "paid" },
            select: { total: true }
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
      const sum = Number(grp._sum.total || 0);
      if (grp.status === "paid") {
        totalPaid += sum;
      } else if (grp.status === "sent" || grp.status === "viewed") {
        totalPending += sum;
      }
    });

    const totalExpenses = Number(expensesAggregate._sum.amount || 0);
    const netEarnings = totalPaid - totalExpenses;

    // Format top clients and sort by revenue
    const topClients = clientsWithPaidInvoices
      .map((c) => {
        const total_revenue = c.invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
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
        select: { total: true, issueDate: true }
      }),
      prisma.expense.findMany({
        where: { userId, date: { gte: sixMonthsAgo } },
        select: { amount: true, date: true }
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
      if (monthlyChartData[key]) monthlyChartData[key].revenue += Number(inv.total);
    });

    recent6mExpenses.forEach((exp) => {
      const d = new Date(exp.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthlyChartData[key]) monthlyChartData[key].expenses += Number(exp.amount);
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
      unresolvedImportIssues,
    ] = await Promise.all([
      prisma.client.count({ where: { userId } }),
      prisma.project.count({ where: { userId } }),
      prisma.invoice.count({ where: { userId } }),
      prisma.expense.count({ where: { userId } }),
      prisma.invoice.aggregate({
        where: { userId, dueDate: { lt: now }, status: { in: ["sent", "viewed", "overdue"] } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.project.findMany({
        where: { userId, dueDate: { gte: now, lte: upcomingCutoff }, status: { notIn: ["completed", "cancelled"] } },
        select: { id: true, title: true, dueDate: true },
        orderBy: { dueDate: "asc" },
        take: 3,
      }),
      prisma.expense.groupBy({
        by: ["category"],
        where: { userId },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 1,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, profession: true, businessType: true },
      }),
      prisma.calendarConnection.count({ where: { userId, status: "connected" } }),
      prisma.portfolio.findUnique({ where: { userId }, select: { status: true, publishedAt: true } }),
      prisma.importIssue.count({
        where: { importJob: { userId }, resolvedAt: null, severity: { in: ["warning", "blocking"] } },
      }),
    ]);

    const receivableBase = totalPaid + totalPending;
    const collectionRate = receivableBase > 0 ? Math.round((totalPaid / receivableBase) * 100) : 0;
    const profitMargin = totalPaid > 0 ? Math.round((netEarnings / totalPaid) * 100) : 0;
    const activationSteps = [
      { id: "profile", label: "Business profile", complete: Boolean(workspaceUser?.name && workspaceUser.profession && workspaceUser.businessType), href: "/onboarding?restart=1" },
      { id: "client", label: "First client", complete: clientCount > 0, href: "/workflow/clients" },
      { id: "project", label: "Active work", complete: projectCount > 0, href: "/workflow/projects" },
      { id: "financial", label: "Financial context", complete: invoiceCount > 0 || expenseCount > 0, href: invoiceCount > 0 ? "/workflow/revenue" : "/workflow/expenses" },
      { id: "calendar", label: "Calendar connected", complete: calendarConnectionCount > 0, href: "/calendar" },
      { id: "portfolio", label: "Portfolio ready", complete: portfolio?.status === "published" || Boolean(portfolio?.publishedAt), href: "/portfolio" },
    ];
    const activation = {
      counts: { clients: clientCount, projects: projectCount, invoices: invoiceCount, expenses: expenseCount },
      completed: activationSteps.filter((step) => step.complete).length,
      total: activationSteps.length,
      steps: activationSteps,
      unresolvedImportIssues,
      next: activationSteps.find((step) => !step.complete) || null,
    };

    return NextResponse.json({
      success: true,
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
      insights: {
        collectionRate,
        profitMargin,
        overdueCount: overdueInvoices._count._all,
        overdueAmount: Number(overdueInvoices._sum.total || 0),
        topExpenseCategory: expenseCategories[0]?.category || null,
        topExpenseAmount: Number(expenseCategories[0]?._sum.amount || 0),
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
