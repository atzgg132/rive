import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { hashInvoicePublicToken } from "@/utils/invoicePublic";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { getRequestIp } from "@/utils/rateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = getRequestIp(req);
  if (!(await durableRateLimit(`public-invoice:${hashRequestValue(token)}:${hashRequestValue(ip)}`, 60, 60 * 60 * 1000))) {
    return NextResponse.json({ success: false, message: "Too many requests." }, { status: 429 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { publicTokenHash: hashInvoicePublicToken(token) }, select: { id: true, userId: true, status: true, sentSnapshot: true, amountPaid: true, total: true, viewedAt: true } });
  if (!invoice || !invoice.sentSnapshot || !["sent", "viewed", "overdue", "partially_paid", "paid"].includes(invoice.status)) {
    return NextResponse.json({ success: false, message: "This invoice link is no longer available." }, { status: 404 });
  }

  const firstView = !invoice.viewedAt;
  await prisma.invoice.update({ where: { id: invoice.id }, data: { viewedAt: invoice.viewedAt || new Date() } }).catch(() => undefined);
  if (firstView) {
    await prisma.invoiceEvent.create({ data: { invoiceId: invoice.id, eventType: "viewed", ipHash: hashRequestValue(ip) } }).catch(() => undefined);
    await recordProductEvent({ userId: invoice.userId, eventName: PRODUCT_EVENTS.invoiceViewed, module: "invoices", entityType: "invoice", entityId: invoice.id, source: "public_link" });
  }

  const snapshot = typeof invoice.sentSnapshot === "object" && invoice.sentSnapshot !== null && !Array.isArray(invoice.sentSnapshot)
    ? (() => {
      const sentSnapshot = invoice.sentSnapshot as Record<string, unknown>;
      const snapshotTotal = typeof sentSnapshot.total === "string" ? new Prisma.Decimal(sentSnapshot.total) : invoice.total;
      return { ...sentSnapshot, amountPaid: invoice.amountPaid.toString(), outstanding: snapshotTotal.sub(invoice.amountPaid).toString() };
    })()
    : invoice.sentSnapshot;
  return NextResponse.json({ success: true, invoice: { status: invoice.status, amountPaid: invoice.amountPaid.toString(), snapshot } }, { headers: { "Cache-Control": "private, no-store" } });
}
