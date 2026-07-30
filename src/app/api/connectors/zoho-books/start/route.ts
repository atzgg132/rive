import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { createConnectorOAuthState } from "@/utils/connectorSecurity";
import { zohoAuthorizationUrl } from "@/utils/zohoBooks";

export async function GET(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) return NextResponse.redirect(new URL("/login?next=/onboarding", req.url));
  try {
    const returnTo = req.nextUrl.searchParams.get("from") === "dashboard" ? "/dashboard" : "/onboarding";
    const state = createConnectorOAuthState(session.userId, "zoho_books", returnTo);
    return NextResponse.redirect(zohoAuthorizationUrl(state));
  } catch (error) {
    console.error("Zoho Books connection start failed:", error);
    return NextResponse.redirect(new URL("/onboarding?connectionError=zoho_not_configured", req.url));
  }
}
