import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/utils/adminSession";
import { adminTotpGate } from "@/utils/adminTotp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authenticated = await hasAdminSession(req);
  return NextResponse.json(
    // totpRequired is safe to advertise pre-auth: an attacker learns nothing
    // they would not discover by submitting a correct password, and the login
    // form needs it to render the code field on first paint. It is true both
    // when a usable secret is configured and when the environment mandates one
    // that is missing or broken — in that state login itself fails closed.
    authenticated
      ? { success: true }
      : { success: false, totpRequired: adminTotpGate(process.env.APP_ENV, process.env.ADMIN_TOTP_SECRET) !== "not_required" },
    {
      status: authenticated ? 200 : 401,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
