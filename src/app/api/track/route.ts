import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getAnonymousId } from "@/utils/attribution";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = typeof body?.path === "string" ? body.path.slice(0, 500) : "/";
    const referrer = typeof body?.referrer === "string" ? body.referrer.slice(0, 500) : null;
    const anonymousId = typeof body?.anonymousId === "string" ? body.anonymousId.slice(0, 100) : getAnonymousId(req);
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 100) : null;
    const user = await getSessionUser(req);
    const userAgent = req.headers.get("user-agent") || "";
    let referrerDomain: string | null = null;
    try { referrerDomain = referrer ? new URL(referrer).hostname.slice(0, 200) : null; } catch { referrerDomain = null; }

    await prisma.pageView.create({
      data: {
        path,
        referrer,
        referrerDomain,
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
        anonymousId,
        sessionId,
        userId: user?.userId || null,
        utmSource: typeof body?.source === "string" ? body.source.slice(0, 120) : null,
        utmMedium: typeof body?.medium === "string" ? body.medium.slice(0, 120) : null,
        utmCampaign: typeof body?.campaign === "string" ? body.campaign.slice(0, 160) : null,
        landingPath: typeof body?.landingPage === "string" ? body.landingPage.slice(0, 500) : path,
      }
    });
    await recordProductEvent({
      userId: user?.userId || null,
      anonymousId,
      sessionId,
      eventName: path === "/" ? PRODUCT_EVENTS.landingViewed : PRODUCT_EVENTS.pageViewed,
      module: path.startsWith("/api") ? "api" : path.startsWith("/dashboard") || path.startsWith("/workflow") || path.startsWith("/calendar") || path.startsWith("/portfolio") ? "workspace" : "marketing",
      properties: { path },
    });
    if (path === "/register") {
      await recordProductEvent({ userId: user?.userId || null, anonymousId, sessionId, eventName: PRODUCT_EVENTS.signupStarted, module: "auth", properties: { path } });
    }
    if (user && (path.startsWith("/dashboard") || path.startsWith("/workflow") || path.startsWith("/calendar") || path.startsWith("/portfolio"))) {
      await recordProductEvent({ userId: user.userId, anonymousId, sessionId, eventName: PRODUCT_EVENTS.workspaceViewed, module: "workspace", source: "page_tracker", properties: { path } });
    }

    return NextResponse.json({ success: true });
  } catch {
    // Return success to client so tracking never blocks page load
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
