import { NextRequest, NextResponse } from "next/server";
import { getDbPool, initDbSchema } from "@/utils/db";
import { sendWelcomeEmail } from "@/utils/email";

export async function POST(req: NextRequest) {
  try {
    const { email, type } = await req.json();
    if (!email || !type) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    const pool = getDbPool();
    await initDbSchema(pool);

    // Duplicate check
    const checkResult = await pool.query("SELECT id FROM waitlist WHERE email = $1;", [email]);
    if (checkResult.rows.length > 0) {
      return NextResponse.json(
        { success: false, message: "email address is already registered." },
        { status: 409 }
      );
    }

    const result = await pool.query(
      "INSERT INTO waitlist (email, type) VALUES ($1, $2) RETURNING id, email, type, status, created_at;",
      [email, type]
    );

    // Welcome email (fire-and-forget, async)
    sendWelcomeEmail(email);

    return NextResponse.json({
      success: true,
      message: "successfully joined the waitlist.",
      data: result.rows[0]
    }, { status: 201 });
  } catch (error: any) {
    console.error("Waitlist API error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
