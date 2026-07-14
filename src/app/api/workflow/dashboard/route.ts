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
    invoicesAggregate.forEach(grp => {
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
      .map(c => {
        const total_revenue = c.invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
        return {
          id: c.id,
          name: c.name,
          company: c.company,
          avatar_color: c.avatarColor,
          total_revenue: total_revenue.toString()
        };
      })
      .filter(c => Number(c.total_revenue) > 0)
      .sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))
      .slice(0, 5);

    // Combine and sort recent activity stream in memory
    const activities: { type: string; title: string; created_at: string; rawDate: Date }[] = [];
    
    recentClients.forEach(c => {
      activities.push({ type: "client_added", title: c.name, created_at: c.createdAt.toISOString(), rawDate: c.createdAt });
    });
    recentProjects.forEach(p => {
      activities.push({ type: "project_created", title: p.title, created_at: p.createdAt.toISOString(), rawDate: p.createdAt });
    });
    recentInvoices.forEach(i => {
      activities.push({ type: "invoice_created", title: `invoice #${i.invoiceNumber}`, created_at: i.createdAt.toISOString(), rawDate: i.createdAt });
    });
    recentExpenses.forEach(e => {
      activities.push({ type: "expense_logged", title: e.description, created_at: e.createdAt.toISOString(), rawDate: e.createdAt });
    });

    const recentActivity = activities
      .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
      .slice(0, 10)
      .map(({ type, title, created_at }) => ({ type, title, created_at }));

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
      recentActivity
    });
  } catch (error: any) {
    console.error("Dashboard analytics error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
