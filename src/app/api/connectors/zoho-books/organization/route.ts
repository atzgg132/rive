import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { confirmZohoOrganization } from "@/utils/zohoBooks";
import { zohoBooksAvailable } from "@/utils/connectorConfig";

/**
 * Confirm which Zoho Books organization this connection maps to.
 *
 * The OAuth callback stores the candidate organizations but deliberately does
 * NOT pick one — onboarding copy promises confirmation. This endpoint is the
 * user's explicit choice; sync refuses to do anything beyond verification
 * until `settings.organizationId` is set here.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!zohoBooksAvailable()) {
    return NextResponse.json({ success: false, message: "Zoho Books direct migration is not available." }, { status: 503 });
  }
  if (!rateLimit(`zoho-org:${session.userId}:${getRequestIp(req)}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const connectionId = typeof body?.connectionId === "string" ? body.connectionId : "";
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  if (!connectionId || !organizationId) {
    return NextResponse.json({ success: false, message: "Connection and organization are required." }, { status: 400 });
  }

  try {
    const connection = await confirmZohoOrganization(connectionId, session.userId, organizationId);
    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        provider: connection.provider,
        accountLabel: connection.accountLabel,
        organizationId: (connection.settings as { organizationId?: string } | null)?.organizationId || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "The organization could not be confirmed.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

/** List the organizations a connection may be mapped to (no auto-select). */
export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!zohoBooksAvailable()) {
    return NextResponse.json({ success: false, message: "Zoho Books direct migration is not available." }, { status: 503 });
  }

  const connectionId = req.nextUrl.searchParams.get("connectionId") || "";
  const connection = await prisma.connectorConnection.findFirst({
    where: { id: connectionId, userId: session.userId, provider: "zoho_books" },
  });
  if (!connection) return NextResponse.json({ success: false, message: "Zoho Books connection not found." }, { status: 404 });

  const settings = (connection.settings as { organizations?: Array<{ id: string; name: string; currency?: string | null }>; organizationId?: string } | null) || {};
  return NextResponse.json({
    success: true,
    organizations: settings.organizations || [],
    organizationId: settings.organizationId || null,
  });
}
