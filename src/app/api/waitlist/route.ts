import { NextRequest, NextResponse } from "next/server";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { normalizeEmailAddress } from "@/lib/email-address";
import { readJsonBody } from "@/utils/apiBoundary";

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    if (!await durableRateLimit(`legacy-waitlist:${ip}`, 8, 60 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }
    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const { email, type } = parsedBody.body;
    const normalizedEmail = normalizeEmailAddress(email);
    const allowedTypes = new Set(["waitlist", "login", "remit"]);
    const normalizedType = typeof type === "string" && allowedTypes.has(type) ? type : null;
    if (!normalizedEmail || !normalizedType) {
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
