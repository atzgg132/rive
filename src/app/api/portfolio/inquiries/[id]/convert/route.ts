import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import {
  convertPortfolioInquiry,
  EngagementInputError,
  parseInquiryConversionInput,
} from "@/utils/engagements";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized.", code: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!rateLimit(`portfolio-inquiry-convert:${session.userId}:${id}:${getRequestIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many conversion attempts. Try again later.", code: "rate_limited" }, { status: 429 });
  }

  try {
    const conversion = parseInquiryConversionInput(await req.json().catch(() => null));
    const result = await convertPortfolioInquiry(session.userId, id, conversion);
    await Promise.all([
      ...(result.createdClient
        ? [recordProductEvent({
            userId: session.userId,
            eventName: PRODUCT_EVENTS.clientCreated,
            module: "clients",
            entityType: "client",
            entityId: result.records.clientId,
            dataOrigin: "user",
            source: "portfolio_inquiry",
            requestId: id,
            dedupeKey: `portfolio-inquiry:${id}:client-created`,
        })]
        : []),
      recordProductEvent({
        userId: session.userId,
        eventName: PRODUCT_EVENTS.portfolioInquiryConverted,
        module: "portfolio",
        entityType: "inquiry",
        entityId: id,
        dataOrigin: "user",
        source: "portfolio_inquiry",
        requestId: id,
        dedupeKey: `portfolio-inquiry:${id}:converted`,
        properties: { createdClient: result.createdClient, taskCreated: true },
      }),
    ]);

    return NextResponse.json({ success: true, records: result.records, nextAction: result.nextAction, replayed: Boolean(result.replayed) }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof EngagementInputError) {
      return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: error.status });
    }
    console.error("Portfolio inquiry conversion error:", error);
    return NextResponse.json({ success: false, message: "The enquiry could not be converted. Nothing was changed.", code: "conversion_failed" }, { status: 500 });
  }
}
