import { NextRequest, NextResponse } from "next/server";
import { getDbPool, initDbSchema } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

// GET /api/workflow/expenses
export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const pool = getDbPool();
    await initDbSchema(pool);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "all";
    const projectId = searchParams.get("projectId") || "";

    const conditions = ["e.user_id = $1"];
    const params: any[] = [session.userId];

    let paramIdx = 2;
    if (search) {
      conditions.push(`e.description ILIKE $${paramIdx}`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (category !== "all") {
      conditions.push(`e.category = $${paramIdx}`);
      params.push(category);
      paramIdx++;
    }

    if (projectId) {
      conditions.push(`e.project_id = $${paramIdx}`);
      params.push(projectId);
      paramIdx++;
    }

    const whereClause = conditions.join(" AND ");

    const query = `
      SELECT e.*, p.title AS project_title
      FROM expenses e
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE ${whereClause}
      ORDER BY e.date DESC, e.created_at DESC;
    `;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      expenses: result.rows
    });
  } catch (error: any) {
    console.error("Expenses fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// POST /api/workflow/expenses
export async function POST(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { project_id, category, description, amount, currency, date, receipt_url, is_billable, is_reimbursed } = await req.json();
    if (!description || amount === undefined) {
      return NextResponse.json({ success: false, message: "Description and amount are required." }, { status: 400 });
    }

    const pool = getDbPool();
    await initDbSchema(pool);

    const result = await pool.query(
      `INSERT INTO expenses (user_id, project_id, category, description, amount, currency, date, receipt_url, is_billable, is_reimbursed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *;`,
      [
        session.userId,
        project_id || null,
        category || "other",
        description,
        parseFloat(amount),
        currency || "USD",
        date || new Date().toISOString().split("T")[0],
        receipt_url || null,
        is_billable || false,
        is_reimbursed || false
      ]
    );

    return NextResponse.json({
      success: true,
      message: "Expense logged successfully.",
      expense: result.rows[0]
    }, { status: 201 });
  } catch (error: any) {
    console.error("Expense log error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
