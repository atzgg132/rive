import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1_000) : "";
  const invoice = await prisma.invoice.findFirst({ where: { id, userId: session.userId }, include: { billingOccurrence: true } });
  if (!invoice) return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
  if (invoice.billingOccurrence) return NextResponse.json({ success: false, message: "Agreement-generated invoices must be handled from the Agreement billing record." }, { status: 409 });
  if (["paid", "partially_paid"].includes(invoice.status) || invoice.amountPaid.gt(0)) return NextResponse.json({ success: false, message: "An invoice with a payment cannot be voided." }, { status: 409 });
  if (["voided", "cancelled"].includes(invoice.status)) return NextResponse.json({ success: false, message: "Invoice is already closed." }, { status: 409 });

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.invoice.updateMany({ where: { id, userId: session.userId, status: { in: ["draft", "sent", "viewed", "overdue"] } }, data: { status: "voided", voidedAt: new Date(), publicTokenHash: null } });
      if (claimed.count !== 1) throw new Error("ALREADY_CLOSED");
      await tx.invoiceEvent.create({ data: { invoiceId: id, userId: session.userId, eventType: "voided", metadata: { reason: reason || null } } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_CLOSED") return NextResponse.json({ success: false, message: "Invoice is already closed." }, { status: 409 });
    console.error("Invoice void error:", error);
    return NextResponse.json({ success: false, message: "Unable to void invoice." }, { status: 500 });
  }
  return NextResponse.json({ success: true, message: "Invoice voided." });
}
