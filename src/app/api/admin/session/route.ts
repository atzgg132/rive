import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/utils/adminSession";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authenticated = await hasAdminSession(req);
  return NextResponse.json(
    // totpRequired is safe to advertise pre-auth: an attacker learns nothing
    // they would not discover by submitting a correct password, and the login
    // form needs it to render the code field on first paint.
    authenticated
      ? { success: true }
      : { success: false, totpRequired: Boolean(process.env.ADMIN_TOTP_SECRET?.trim()) },
    {
      status: authenticated ? 200 : 401,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
