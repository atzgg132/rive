import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { hashInvoicePublicToken } from "@/utils/invoicePublic";
import { isPublicInvoiceLinkAvailable } from "@/utils/invoiceSend";
import { durableRateLimit } from "@/utils/durableRateLimit";
import { getRequestIp } from "@/utils/rateLimit";
import { hashRequestValue } from "@/utils/contracts";
import { renderInvoicePdf, InvoicePdfSnapshot } from "@/utils/invoicePdf";

function filename(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 80) || "invoice";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = getRequestIp(req);
  if (!(await durableRateLimit(`public-invoice-pdf:${hashRequestValue(token)}:${hashRequestValue(ip)}`, 30, 60 * 60 * 1000))) {
    return NextResponse.json({ success: false, message: "Too many requests." }, { status: 429 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { publicTokenHash: hashInvoicePublicToken(token) }, select: { id: true, status: true, sentSnapshot: true, amountPaid: true, total: true } });
  if (!invoice || !isPublicInvoiceLinkAvailable(invoice)) {
    return NextResponse.json({ success: false, message: "This invoice link is no longer available." }, { status: 404 });
  }
  if (typeof invoice.sentSnapshot !== "object" || Array.isArray(invoice.sentSnapshot)) {
    return NextResponse.json({ success: false, message: "This invoice document is unavailable." }, { status: 404 });
  }

  try {
    const original = invoice.sentSnapshot as unknown as InvoicePdfSnapshot;
    const snapshotTotal = new Prisma.Decimal(original.total || invoice.total.toString());
    const snapshot = { ...original, amountPaid: invoice.amountPaid.toString(), outstanding: snapshotTotal.sub(invoice.amountPaid).toString() } satisfies InvoicePdfSnapshot;
    const pdf = await renderInvoicePdf(snapshot);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename(snapshot.invoiceNumber)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Public invoice PDF error:", error);
    return NextResponse.json({ success: false, message: "The invoice document could not be generated." }, { status: 503 });
  }
}
