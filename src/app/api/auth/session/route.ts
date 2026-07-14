import { NextRequest, NextResponse } from "next/server";
import { getDbPool, initDbSchema } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "No active session found." }, { status: 401 });
    }

    const pool = getDbPool();
    await initDbSchema(pool);

    const result = await pool.query(
      "SELECT id, email, name, plan, avatar_url, created_at FROM users WHERE id = $1;",
      [session.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error: any) {
    console.error("Session fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
