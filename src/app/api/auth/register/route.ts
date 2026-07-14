import { NextRequest, NextResponse } from "next/server";
import { getDbPool, initDbSchema } from "@/utils/db";
import { hashPassword, generateUserToken, TOKEN_COOKIE_NAME, SESSION_TTL_MS } from "@/utils/userAuth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password || !name) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    const pool = getDbPool();
    await initDbSchema(pool);

    // Check if user already exists
    const existing = await pool.query("SELECT id FROM users WHERE email = $1;", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ success: false, message: "Email is already registered." }, { status: 409 });
    }

    const passwordHash = hashPassword(password);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, plan) 
       VALUES ($1, $2, $3, 'free') 
       RETURNING id, email, name, plan;`,
      [email.toLowerCase(), passwordHash, name]
    );

    const user = result.rows[0];
    const token = generateUserToken(user.id, user.email, user.plan);

    // Create response and set cookie
    const response = NextResponse.json({
      success: true,
      message: "Registration successful.",
      user
    }, { status: 201 });

    response.cookies.set({
      name: TOKEN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_MS / 1000,
      path: "/"
    });

    return response;
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ success: false, message: error.message || "Internal server error." }, { status: 500 });
  }
}
