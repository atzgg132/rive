import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

// GET /api/workflow/expenses
export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "all";
    const projectId = searchParams.get("projectId") || "";

    const where: any = {
      userId: session.userId
    };

    if (search) {
      where.description = { contains: search, mode: "insensitive" };
    }

    if (category !== "all") {
      where.category = category;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        project: { select: { title: true } }
      },
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" }
      ]
    });

    const formattedExpenses = expenses.map(e => ({
      id: e.id,
      project_id: e.projectId,
      user_id: e.userId,
      category: e.category,
      description: e.description,
      amount: e.amount.toString(),
      currency: e.currency,
      date: e.date,
      receipt_url: e.receiptUrl,
      is_billable: e.isBillable,
      is_reimbursed: e.isReimbursed,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
      project_title: e.project?.title || null
    }));

    return NextResponse.json({
      success: true,
      expenses: formattedExpenses
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

    const expense = await prisma.expense.create({
      data: {
        userId: session.userId,
        projectId: project_id || null,
        category: category || "other",
        description,
        amount: Number(amount),
        currency: currency || "USD",
        date: date ? new Date(date) : new Date(),
        receiptUrl: receipt_url || null,
        isBillable: is_billable || false,
        isReimbursed: is_reimbursed || false
      }
    });

    const formattedExpense = {
      ...expense,
      project_id: expense.projectId,
      user_id: expense.userId,
      amount: expense.amount.toString(),
      receipt_url: expense.receiptUrl,
      is_billable: expense.isBillable,
      is_reimbursed: expense.isReimbursed,
      created_at: expense.createdAt,
      updated_at: expense.updatedAt
    };

    return NextResponse.json({
      success: true,
      message: "Expense logged successfully.",
      expense: formattedExpense
    }, { status: 201 });
  } catch (error: any) {
    console.error("Expense log error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
