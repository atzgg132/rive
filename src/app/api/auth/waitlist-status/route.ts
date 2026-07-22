import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ success: false, message: "Email parameter is required." }, { status: 400 });
    }

    const waitlistEntry = await prisma.waitlist.findUnique({
      where: { email }
    });

    if (!waitlistEntry) {
      return NextResponse.json({ success: true, status: "not_found", message: "Email not found in waitlist." });
    }

    return NextResponse.json({ 
      success: true, 
      status: waitlistEntry.status, // "approved" | "pending"
      message: `Your waitlist status is ${waitlistEntry.status}.` 
    });

  } catch (error: unknown) {
    console.error("Waitlist status fetch error:", error);
    return NextResponse.json({
      success: false,
      message: "Internal server error."
    }, { status: 500 });
  }
}
