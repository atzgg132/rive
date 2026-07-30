import { NextRequest, NextResponse } from "next/server";
import { generateToken } from "@/utils/auth";
import { verifyPassword } from "@/utils/userAuth";
import { rateLimit, getRequestIp } from "@/utils/rateLimit";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const PLACEHOLDER_HASH = "PLACEHOLDER_RUN_node_scripts/setup-admin.mjs";

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req);
  if (!rateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { success: false, message: "Too many attempts. Please wait and try again." },
      { status: 429 }
    );
  }

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || ADMIN_PASSWORD_HASH === PLACEHOLDER_HASH) {
    console.error("Admin credentials not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD_HASH environment variables.");
    return NextResponse.json(
      { success: false, message: "Admin portal unavailable." },
      { status: 503 }
    );
  }

  try {
    const { username, password } = await req.json();

    if (username !== ADMIN_USERNAME) {
      return NextResponse.json({ success: false, message: "Invalid credentials." }, { status: 401 });
    }

    const isValid = verifyPassword(password, ADMIN_PASSWORD_HASH);
    if (!isValid) {
      return NextResponse.json({ success: false, message: "Invalid credentials." }, { status: 401 });
    }

    const token = generateToken();
    return NextResponse.json({ success: true, token });
  } catch {
    return NextResponse.json({ success: false, message: "Bad request." }, { status: 400 });
  }
}
