import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/utils/userAuth";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { createAdminSession } from "@/utils/adminSession";
import { prisma } from "@/utils/db";
import { hashRequestValue } from "@/utils/contracts";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const PLACEHOLDER_HASH = "PLACEHOLDER_RUN_node_scripts/setup-admin.mjs";

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req);
  const tooManyAttempts = NextResponse.json(
    { success: false, message: "Too many attempts. Please wait and try again." },
    { status: 429 },
  );

  // This endpoint authenticates one fixed account, so a per-IP counter alone
  // bounds nothing an attacker cannot sidestep by changing address. The global
  // ceiling is the real limit; the per-IP one only stops a single source from
  // consuming it. Both have to pass.
  if (!await durableRateLimit("admin-login:global", 30, 15 * 60 * 1000)) return tooManyAttempts;
  if (!await durableRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000)) return tooManyAttempts;

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

    const response = NextResponse.json({ success: true, message: "Admin session created." });
    await createAdminSession(req, response);
    await prisma.auditEvent.create({ data: { action: "admin.login", targetType: "admin_session", metadata: { username: ADMIN_USERNAME }, ipHash: hashRequestValue(ip) } }).catch((error) => console.warn("Admin access audit failed:", error));
    return response;
  } catch {
    return NextResponse.json({ success: false, message: "Bad request." }, { status: 400 });
  }
}
