import { NextRequest, NextResponse } from "next/server";
import { getDbPool, initDbSchema } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const pool = getDbPool();
    await initDbSchema(pool);

    // Run aggregations in parallel
    const [revenueRes, projectsRes, expensesRes, topClientsRes, recentActivitiesRes] = await Promise.all([
      // Paid & Pending Revenue
      pool.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0)::numeric AS total_paid,
           COALESCE(SUM(CASE WHEN status IN ('sent', 'viewed') THEN total ELSE 0 END), 0)::numeric AS total_pending
         FROM invoices 
         WHERE user_id = $1;`,
        [session.userId]
      ),
      // Active Projects Count
      pool.query(
        `SELECT COUNT(*)::int AS active_count FROM projects WHERE user_id = $1 AND status = 'active';`,
        [session.userId]
      ),
      // Total Expenses
      pool.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses FROM expenses WHERE user_id = $1;`,
        [session.userId]
      ),
      // Top Clients by Revenue
      pool.query(
        `SELECT c.id, c.name, c.company, c.avatar_color,
           COALESCE(SUM(i.total), 0)::numeric AS total_revenue
         FROM clients c
         INNER JOIN invoices i ON i.client_id = c.id AND i.status = 'paid'
         WHERE c.user_id = $1
         GROUP BY c.id
         ORDER BY total_revenue DESC
         LIMIT 5;`,
        [session.userId]
      ),
      // Recent activities (combine recent client additions, project creation, invoice changes, logged expenses)
      pool.query(
        `(SELECT 'client_added' AS type, name AS title, created_at FROM clients WHERE user_id = $1)
         UNION ALL
         (SELECT 'project_created' AS type, title, created_at FROM projects WHERE user_id = $1)
         UNION ALL
         (SELECT 'invoice_created' AS type, 'invoice #' || invoice_number AS title, created_at FROM invoices WHERE user_id = $1)
         UNION ALL
         (SELECT 'expense_logged' AS type, description AS title, created_at FROM expenses WHERE user_id = $1)
         ORDER BY created_at DESC
         LIMIT 10;`,
        [session.userId]
      )
    ]);

    const totalPaid = parseFloat(revenueRes.rows[0].total_paid);
    const totalPending = parseFloat(revenueRes.rows[0].total_pending);
    const activeProjects = projectsRes.rows[0].active_count;
    const totalExpenses = parseFloat(expensesRes.rows[0].total_expenses);
    const netEarnings = totalPaid - totalExpenses;

    return NextResponse.json({
      success: true,
      stats: {
        totalPaid,
        totalPending,
        activeProjects,
        totalExpenses,
        netEarnings
      },
      topClients: topClientsRes.rows,
      recentActivity: recentActivitiesRes.rows
    });
  } catch (error: any) {
    console.error("Dashboard analytics error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
