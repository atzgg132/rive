import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/utils/db";
import { verifyToken } from "@/utils/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("x-admin-token");
  if (!verifyToken(token)) {
    return NextResponse.json({ success: false, message: "unauthorised." }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: "invalid id." }, { status: 400 });
    }

    const { status } = await req.json();
    if (status !== "approved" && status !== "pending") {
      return NextResponse.json(
        { success: false, message: "status must be 'approved' or 'pending'." },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    const result = await pool.query(
      "UPDATE waitlist SET status = $1 WHERE id = $2 RETURNING id, email, type, status, created_at;",
      [status, id]
    );

    if (!result.rows.length) {
      return NextResponse.json({ success: false, message: "entry not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Waitlist update error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
