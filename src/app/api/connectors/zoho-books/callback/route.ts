import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { verifyConnectorOAuthState } from "@/utils/connectorSecurity";
import { exchangeZohoCode, getZohoOrganizations, saveZohoConnection } from "@/utils/zohoBooks";
import { prisma } from "@/utils/db";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  const code = req.nextUrl.searchParams.get("code");
  const state = verifyConnectorOAuthState(req.nextUrl.searchParams.get("state") || "", "zoho_books");
  if (!session || !state || state.userId !== session.userId || !code) {
    return NextResponse.redirect(new URL("/onboarding?connectionError=invalid_zoho_callback", req.url));
  }
  try {
    const credentials = await exchangeZohoCode(code, req.nextUrl.searchParams.get("accounts-server"));
    const organizations = await getZohoOrganizations(credentials);
    const connection = await saveZohoConnection(session.userId, credentials, organizations);
    await prisma.auditEvent.create({
      data: {
        userId: session.userId,
        action: "connector.connected",
        targetType: "connector_connection",
        targetId: connection.id,
        metadata: { provider: "zoho_books", organizationCount: organizations.length },
      },
    });
    // The connection is saved but the organization is NOT auto-selected. The
    // user confirms it explicitly before any sync runs (see
    // POST /api/connectors/zoho-books/organization).
    return NextResponse.redirect(new URL(`${state.returnTo}?connected=zoho_books&zohoOrgConfirmation=1`, req.url));
  } catch (error) {
    console.error("Zoho Books callback failed:", error);
    return NextResponse.redirect(new URL(`${state.returnTo}?connectionError=zoho_connection_failed`, req.url));
  }
}
