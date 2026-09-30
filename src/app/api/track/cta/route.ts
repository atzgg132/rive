import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { getAnonymousId } from "@/utils/attribution";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { sanitizeAnalyticsPath } from "@/lib/route-privacy";
import { readJsonBody } from "@/utils/apiBoundary";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { getRequestIp } from "@/utils/rateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { MARKETING_CTA_PLACEMENT_SET } from "@/lib/domain-vocabulary";

/** Records which marketing "Start free" button was clicked. Accepts only a
 * known placement and a sanitized path; always answers 200 so tracking can
 * never surface an error to a visitor on their way to signup. */
export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    if (!(await durableRateLimit(`marketing-cta:${hashRequestValue(ip)}`, 60, 60 * 60 * 1000))) {
      return NextResponse.json({ success: false }, { status: 200 });
    }
    const parsed = await readJsonBody(req, { allowEmpty: true });
    if (!parsed.ok) return NextResponse.json({ success: false }, { status: 200 });
    const placement = typeof parsed.body.placement === "string" ? parsed.body.placement : "";
    if (!MARKETING_CTA_PLACEMENT_SET.has(placement)) return NextResponse.json({ success: false }, { status: 200 });

    const user = await getSessionUser(req);
    const anonymousId = getAnonymousId(req);
    if (!user && !anonymousId) return NextResponse.json({ success: false }, { status: 200 });

    await recordProductEvent({
      userId: user?.userId || null,
      anonymousId,
      eventName: PRODUCT_EVENTS.marketingCtaClicked,
      module: "marketing",
      properties: { placement, path: sanitizeAnalyticsPath(parsed.body.path) },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
