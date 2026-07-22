import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { sendWelcomeEmail } from "@/utils/email";

export async function POST(req: NextRequest) {
  try {
    let payload: { email?: unknown; type?: unknown };
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: "Request body must be valid JSON." }, { status: 400 });
    }
    const { email, type } = payload;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const allowedTypes = new Set(["waitlist", "login", "demo", "remit"]);
    const normalizedType = typeof type === "string" && allowedTypes.has(type) ? type : null;
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || !normalizedType) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    // Duplicate check
    const existing = await prisma.waitlist.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "email address is already registered." },
        { status: 409 }
      );
    }

    const waitlistEntry = await prisma.waitlist.create({
      data: {
        email: normalizedEmail,
        type: normalizedType
      }
    });

    // Welcome email (fire-and-forget, async)
    void sendWelcomeEmail(normalizedEmail);

    return NextResponse.json({
      success: true,
      message: "successfully joined the waitlist.",
      data: waitlistEntry
    }, { status: 201 });
  } catch (error) {
    console.error("Waitlist API error:", error);
    return NextResponse.json({
      success: false,
      message: "Internal server error."
    }, { status: 500 });
  }
}
