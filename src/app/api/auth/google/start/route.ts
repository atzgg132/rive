import { NextRequest, NextResponse } from "next/server";
import { googleLoginAvailable } from "@/utils/connectorConfig";
import { createGoogleLoginState, googleLoginAuthorizationUrl } from "@/utils/googleAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";

function loginError(req: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/login?google_error=${code}`, process.env.APP_URL || req.url));
}

export async function GET(req: NextRequest) {
  try {
    if (!googleLoginAvailable()) return loginError(req, "not_configured");
    const ip = getRequestIp(req);
    if (!rateLimit(`auth:google:${ip}`, 20, 15 * 60 * 1000)) {
      return loginError(req, "invalid_callback");
    }
    const state = createGoogleLoginState(req.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(googleLoginAuthorizationUrl(state));
  } catch (error) {
    console.error("Google sign-in start failed:", error);
    return loginError(req, "not_configured");
  }
}
