import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { verifyPassword, generateUserToken, TOKEN_COOKIE_NAME, SESSION_TTL_MS } from "@/utils/userAuth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Missing email or password." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "Invalid email or password." }, { status: 401 });
    }

    const isPasswordCorrect = verifyPassword(password, user.passwordHash);

    if (!isPasswordCorrect) {
      return NextResponse.json({ success: false, message: "Invalid email or password." }, { status: 401 });
    }

    const token = generateUserToken(user.id, user.email, user.plan);

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan
      }
    });

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
    console.error("Login error:", error);
    return NextResponse.json({ success: false, message: error.message || "Internal server error." }, { status: 500 });
  }
}
