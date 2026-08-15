import { NextRequest, NextResponse } from "next/server";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    if (!await durableRateLimit(`legacy-waitlist:${ip}`, 8, 60 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }
    let payload: { email?: unknown; type?: unknown };
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: "Request body must be valid JSON." }, { status: 400 });
    }
    const { email, type } = payload;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const allowedTypes = new Set(["waitlist", "login", "remit"]);
    const normalizedType = typeof type === "string" && allowedTypes.has(type) ? type : null;
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || !normalizedType) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      code: "OPEN_SIGNUP",
      message: "Rive is now open. Create a free account to get started.",
      signupUrl: "/register",
    }, { status: 410 });
  } catch (error) {
    console.error("Waitlist API error:", error);
    return NextResponse.json({
      success: false,
      message: "Internal server error."
    }, { status: 500 });
  }
}
