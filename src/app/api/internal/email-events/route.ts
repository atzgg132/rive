import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/utils/db";
import { parseProviderEmailEvent } from "@/utils/emailEvents";
import { logger, requestLogContext } from "@/utils/logger";
import { readJsonBody } from "@/utils/apiBoundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const context = requestLogContext(request);
  const authorization = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const event = parseProviderEmailEvent(parsedBody.body);
  if (!event) {
    return NextResponse.json({ success: false, message: "Invalid provider email event." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const deliveries = await tx.emailDelivery.updateMany({
      where: {
        providerMessageId: event.messageId,
        ...(event.status === "delivered" ? { status: { not: "delivery_failed" } } : {}),
      },
      data: { status: event.status, error: event.reason },
    });
    if (deliveries.count === 0 && event.recipients.length) {
      await tx.emailDelivery.createMany({
        data: event.recipients.map((recipient) => ({
          recipient,
          type: "transactional",
          status: event.status,
          providerMessageId: event.messageId,
          error: event.reason,
        })),
      });
    }

    const invoiceDeliveries = await tx.invoiceDelivery.updateMany({
      where: {
        providerMessageId: event.messageId,
        ...(event.status === "delivered" ? { status: { not: "delivery_failed" } } : {}),
      },
      data: {
        status: event.status,
        error: event.status === "delivered" ? null : event.reason || "Provider delivery failed.",
      },
    });

    if (event.suppressRecipients) {
      for (const email of event.recipients) {
        await tx.emailSuppression.upsert({
          where: { email },
          create: { email, reason: event.reason || event.kind.toLowerCase(), source: "ses" },
          update: { reason: event.reason || event.kind.toLowerCase(), source: "ses" },
        });
      }
    }

    return { deliveryRecords: deliveries.count, invoiceDeliveryRecords: invoiceDeliveries.count };
  });

  logger.info("email_provider_event_processed", {
    ...context,
    providerEvent: event.kind,
    deliveryStatus: event.status,
    recipients: event.recipients.length,
    suppressions: event.suppressRecipients ? event.recipients.length : 0,
    matchedDeliveryRecords: result.deliveryRecords,
  });

  return NextResponse.json({ success: true, ...result });
}
