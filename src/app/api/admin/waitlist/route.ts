import { NextRequest, NextResponse } from "next/server";
import { getDbPool, initDbSchema } from "@/utils/db";
import { verifyToken } from "@/utils/auth";

const ALLOWED_SORT  = ["email", "type", "status", "created_at", "id"] as const;
const ALLOWED_ORDER = ["ASC", "DESC"] as const;

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (!verifyToken(token)) {
    return NextResponse.json({ success: false, message: "unauthorised." }, { status: 401 });
  }

  try {
    const pool = getDbPool();
    await initDbSchema(pool);

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get("page")  || "1", 10));
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const type   = searchParams.get("type")   || "all";
    const rawSort  = searchParams.get("sort")  || "created_at";
    const rawOrder = (searchParams.get("order") || "DESC").toUpperCase();

    // Whitelist sort options to prevent SQL injection
    const sortCol  = ALLOWED_SORT.includes(rawSort  as any) ? rawSort  : "created_at";
    const sortDir  = ALLOWED_ORDER.includes(rawOrder as any) ? rawOrder : "DESC";

    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (search) {
      conditions.push(`email ILIKE $${p++}`);
      params.push(`%${search}%`);
    }
    if (status !== "all") {
      conditions.push(`status = $${p++}`);
      params.push(status);
    }
    if (type !== "all") {
      conditions.push(`type = $${p++}`);
      params.push(type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM waitlist ${where};`, params),
      pool.query(
        `SELECT id, email, type, status, created_at FROM waitlist ${where}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${p++} OFFSET $${p++};`,
        [...params, limit, offset]
      ),
    ]);

    return NextResponse.json({
      success: true,
      data:    dataRes.rows,
      total:   countRes.rows[0].count,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Waitlist fetch error:", error);
    return NextResponse.json({
      success: false,
      message: "Internal server error.",
      error: error.message || String(error),
      stack: error.stack || ""
    }, { status: 500 });
  }
}
