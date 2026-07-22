import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "No active session found." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        avatarUrl: true,
        createdAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }

    // Format fields for frontend compatibility
    const formattedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      avatar_url: user.avatarUrl,
      created_at: user.createdAt
    };

    return NextResponse.json({
      success: true,
      user: formattedUser
    });
  } catch (error: unknown) {
    console.error("Session fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
