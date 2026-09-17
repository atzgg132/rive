import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/utils/userAuth";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { createAdminSession } from "@/utils/adminSession";
import { adminTotpGate, isProductionAdminEnvironment, verifyTotp } from "@/utils/adminTotp";
import { prisma } from "@/utils/db";
import { hashRequestValue } from "@/utils/contracts";
import { logger, requestLogContext } from "@/utils/logger";
import { readJsonBody } from "@/utils/apiBoundary";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const PLACEHOLDER_HASH = "PLACEHOLDER_RUN_node_scripts/setup-admin.mjs";

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req);
  const context = requestLogContext(req);
  const tooManyAttempts = NextResponse.json(
    { success: false, message: "Too many attempts. Please wait and try again." },
    { status: 429 },
  );

  // This endpoint authenticates one fixed account, so a per-IP counter alone
  // bounds nothing an attacker cannot sidestep by changing address. The global
  // ceiling is the real limit; the per-IP one only stops a single source from
  // consuming it. Both have to pass.
  if (!await durableRateLimit("admin-login:global", 30, 15 * 60 * 1000)) {
    logger.warn("admin_login_rate_limited", { ...context, scope: "global" });
    return tooManyAttempts;
  }
  if (!await durableRateLimit(`admin-login:${hashRequestValue(ip)}`, 5, 15 * 60 * 1000)) {
    logger.warn("admin_login_rate_limited", { ...context, scope: "ip" });
    return tooManyAttempts;
  }

  const passwordHash = ADMIN_PASSWORD_HASH;
  if (!ADMIN_USERNAME || !passwordHash || passwordHash === PLACEHOLDER_HASH) {
    logger.error("admin_login_unconfigured", context);
    return NextResponse.json(
      { success: false, message: "Admin portal unavailable." },
      { status: 503 }
    );
  }

  // The second factor fails closed: production can never sign in without a
  // working TOTP secret, and a provisioned-but-broken secret closes the route
  // in every environment instead of silently degrading to password-only.
  const totpSecret = process.env.ADMIN_TOTP_SECRET?.trim() || "";
  const totpGate = adminTotpGate(process.env.APP_ENV, totpSecret);
  if (totpGate === "unavailable") {
    logger.error("admin_login_totp_unavailable", {
      ...context,
      production: isProductionAdminEnvironment(process.env.APP_ENV),
      // Whether a value was provisioned at all distinguishes "missing" from
      // "malformed"; named without "secret"/"totp" so the redactor keeps it.
      configured: Boolean(totpSecret),
    });
    return NextResponse.json(
      { success: false, message: "Admin portal unavailable." },
      { status: 503 }
    );
  }

  try {
    const parsedBody = await readJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const { username, password, code } = parsedBody.body as { username?: string; password?: string; code?: string };

    if (username !== ADMIN_USERNAME) {
      logger.warn("admin_login_failed", { ...context, reason: "invalid_credentials" });
      return NextResponse.json({ success: false, message: "Invalid credentials." }, { status: 401 });
    }

    const isValid = verifyPassword(password ?? "", passwordHash);
    if (!isValid) {
      logger.warn("admin_login_failed", { ...context, reason: "invalid_credentials" });
      return NextResponse.json({ success: false, message: "Invalid credentials." }, { status: 401 });
    }

    // TOTP is the second factor whenever the secret is provisioned; the form
    // learns whether to show the field from the session check, so these codes
    // only matter for clients that got here without it.
    if (totpGate === "required") {
      if (typeof code !== "string" || !code.trim()) {
        logger.warn("admin_login_failed", { ...context, reason: "totp_required" });
        return NextResponse.json({ success: false, code: "totp_required", message: "Enter the 6-digit authenticator code." }, { status: 401 });
      }
      if (!verifyTotp(code.trim(), totpSecret)) {
        logger.warn("admin_login_failed", { ...context, reason: "totp_invalid" });
        return NextResponse.json({ success: false, code: "totp_invalid", message: "Invalid authenticator code." }, { status: 401 });
      }
    }

    const response = NextResponse.json({ success: true, message: "Admin session created." });
    await createAdminSession(req, response);
    logger.info("admin_session_created", { ...context, secondFactor: totpGate === "required" });
    await prisma.auditEvent.create({ data: { action: "admin.login", targetType: "admin_session", metadata: { username: ADMIN_USERNAME, totp: totpGate === "required" }, ipHash: hashRequestValue(ip) } })
      .catch((error) => logger.warn("admin_audit_write_failed", { ...context, error }));
    return response;
  } catch {
    return NextResponse.json({ success: false, message: "Bad request." }, { status: 400 });
  }
}
