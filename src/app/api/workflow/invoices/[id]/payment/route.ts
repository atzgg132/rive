import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { currencyFractionDigits } from "@/utils/invoiceMath";

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().slice(0, max);
  return result || null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const rawAmount = body?.amount;
  const amountText = typeof rawAmount === "number" ? String(rawAmount) : typeof rawAmount === "string" ? rawAmount.trim() : "";
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(amountText)) return NextResponse.json({ success: false, message: "Enter a valid positive payment amount." }, { status: 400 });
  const requestedAmount = new Prisma.Decimal(amountText);
  if (requestedAmount.lte(0) || requestedAmount.gt(1_000_000_000)) return NextResponse.json({ success: false, message: "Payment amount is outside the supported range." }, { status: 400 });
  const method = clean(body?.method, 40) || "manual";
  const reference = clean(body?.reference, 160);
  const notes = clean(body?.notes, 1_000);
  const rawIdempotencyKey = req.headers.get("idempotency-key") || (typeof body?.idempotency_key === "string" ? body.idempotency_key : "");
  const idempotencyKey = rawIdempotencyKey.trim().slice(0, 128) || null;

  try {
    const payment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoices" WHERE "id" = ${id} AND "user_id" = ${session.userId} FOR UPDATE`);
      const invoice = await tx.invoice.findFirst({ where: { id, userId: session.userId } });
      if (!invoice) throw new Error("NOT_FOUND");
      if (!["sent", "viewed", "overdue", "partially_paid"].includes(invoice.status)) throw new Error("PAYMENT_STATUS");
      if (idempotencyKey) {
        const previous = await tx.invoicePayment.findUnique({ where: { invoiceId_idempotencyKey: { invoiceId: id, idempotencyKey } } });
        if (previous) return { created: previous, duplicate: true };
      }
      const amount = requestedAmount.toDecimalPlaces(currencyFractionDigits(invoice.currency), Prisma.Decimal.ROUND_HALF_UP);
      if (amount.lte(0)) throw new Error("PAYMENT_TOO_SMALL");
      const outstanding = invoice.total.sub(invoice.amountPaid);
      if (amount.gt(outstanding)) throw new Error("PAYMENT_EXCEEDS_OUTSTANDING");
      const nextAmountPaid = invoice.amountPaid.add(amount);
      const fullyPaid = nextAmountPaid.gte(invoice.total);
      const created = await tx.invoicePayment.create({ data: { invoiceId: id, amount, method, reference, notes, idempotencyKey } });
      await tx.invoice.update({ where: { id }, data: { amountPaid: nextAmountPaid, status: fullyPaid ? "paid" : "partially_paid", paidDate: fullyPaid ? new Date() : null } });
      await tx.invoiceEvent.create({ data: { invoiceId: id, userId: session.userId, eventType: fullyPaid ? "paid" : "payment_recorded", metadata: { amount: amount.toString(), method } } });
      return { created, duplicate: false };
    });
    if (!payment.duplicate) await recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.paymentRecorded, module: "invoices", entityType: "invoice", entityId: id, properties: { method } });
    return NextResponse.json({ success: true, paymentId: payment.created.id, duplicate: payment.duplicate, message: payment.duplicate ? "Payment was already recorded." : "Payment recorded." }, { status: payment.duplicate ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
    if (message === "PAYMENT_STATUS") return NextResponse.json({ success: false, message: "Only issued invoices can receive a payment." }, { status: 409 });
    if (message === "PAYMENT_EXCEEDS_OUTSTANDING") return NextResponse.json({ success: false, message: "Payment cannot exceed the outstanding balance." }, { status: 400 });
    if (message === "PAYMENT_TOO_SMALL") return NextResponse.json({ success: false, message: "Payment is smaller than the currency's supported precision." }, { status: 400 });
    console.error("Invoice payment error:", error);
    return NextResponse.json({ success: false, message: "Payment could not be recorded." }, { status: 500 });
  }
}
