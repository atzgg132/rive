import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { hashPassword, generateUserToken, TOKEN_COOKIE_NAME, SESSION_TTL_MS } from "@/utils/userAuth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password || !name) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true }
    });

    if (existing) {
      return NextResponse.json({ success: false, message: "Email is already registered." }, { status: 409 });
    }

    const passwordHash = hashPassword(password);

    // Insert user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        plan: "free"
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true
      }
    });

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
