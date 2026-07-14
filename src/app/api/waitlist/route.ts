import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { sendWelcomeEmail } from "@/utils/email";

export async function POST(req: NextRequest) {
  try {
    const { email, type } = await req.json();
    if (!email || !type) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    // Duplicate check
    const existing = await prisma.waitlist.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "email address is already registered." },
        { status: 409 }
      );
    }

    const waitlistEntry = await prisma.waitlist.create({
      data: {
        email: email.toLowerCase(),
        type
      }
    });

    // Welcome email (fire-and-forget, async)
    sendWelcomeEmail(email);

    return NextResponse.json({
      success: true,
      message: "successfully joined the waitlist.",
      data: waitlistEntry
    }, { status: 201 });
  } catch (error: any) {
    console.error("Waitlist API error:", error);
    return NextResponse.json({
      success: false,
      message: "Internal server error.",
      error: error.message || String(error),
      stack: error.stack || ""
    }, { status: 500 });
  }
}
