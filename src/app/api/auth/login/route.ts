import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { verifyPassword, generateUserToken, setSessionCookie } from "@/utils/userAuth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || typeof password !== "string" || !password) {
      return NextResponse.json({ success: false, message: "Missing email or password." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
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

    setSessionCookie(response, token);

    return response;
  } catch (error: unknown) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Internal server error." }, { status: 500 });
  }
}
