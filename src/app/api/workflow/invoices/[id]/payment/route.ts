import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { currencyFractionDigits } from "@/utils/invoiceMath";
import { readJsonBody } from "@/utils/apiBoundary";
import { InvalidIdempotencyKeyError, normalizeIdempotencyKey } from "@/utils/idempotency";
import { enqueuePaidReceiptIfEnabled } from "@/utils/invoiceReminders";

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().slice(0, max);
  return result || null;
}

/* Received-on date handling (MONEY-02). The user picks a calendar day, not a
   timestamp, so the route stores local midnight in the owner's timezone as
   `paidAt` and keeps `createdAt` as the real entry moment. Every helper below
   is date-only: comparing or bucketing by these strings can never drift the
   day across a viewer's timezone or a month boundary. */
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function timeZoneFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    calendar: "iso8601",
    numberingSystem: "latn",
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function dateTimeFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    calendar: "iso8601",
    numberingSystem: "latn",
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function partsOf(formatter: Intl.DateTimeFormat, value: Date): Record<string, string> {
  if (Number.isNaN(value.getTime())) throw new Error("PAYMENT_DATE_INVALID");
  return Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));
}

/** Whether a value is a real ISO calendar date without a time component. */
function isValidReceivedOn(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

/** Use the owner's timezone when the runtime supports it, else UTC. */
function normalizePaymentTimeZone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "UTC";
  try {
    timeZoneFormatter(value).format();
    return value;
  } catch {
    return "UTC";
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Today's calendar date in the owner's timezone: the default Received-on. */
function todayInTimeZone(now: Date, timeZone: string): string {
  const parts = partsOf(timeZoneFormatter(normalizePaymentTimeZone(timeZone)), now);
  return `${String(parts.year).padStart(4, "0")}-${pad2(Number(parts.month))}-${pad2(Number(parts.day))}`;
}

/** The calendar date a stored timestamp reads as in the owner's timezone. */
function paidAtToReceivedOn(value: Date | string, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = partsOf(timeZoneFormatter(normalizePaymentTimeZone(timeZone)), date);
  return `${String(parts.year).padStart(4, "0")}-${pad2(Number(parts.month))}-${pad2(Number(parts.day))}`;
}

/**
 * Encode a date-only receipt as local midnight in the owner's timezone.
 * Dates with no representable instant in the zone (a whole skipped civil day)
 * are rejected rather than silently moved.
 */
function receivedOnToInstant(dateOnly: string, timeZone: string): Date {
  if (!isValidReceivedOn(dateOnly)) throw new Error("PAYMENT_DATE_INVALID");
  const normalized = normalizePaymentTimeZone(timeZone);
  const [year, month, day] = dateOnly.split("-").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);
  let candidate = targetUtc;
  for (let index = 0; index < 4; index += 1) {
    const local = partsOf(dateTimeFormatter(normalized), new Date(candidate));
    const localAsUtc = Date.UTC(
      Number(local.year), Number(local.month) - 1, Number(local.day),
      Number(local.hour), Number(local.minute), Number(local.second),
    );
    candidate += targetUtc - localAsUtc;
  }
  const result = new Date(candidate);
  if (paidAtToReceivedOn(result, normalized) === dateOnly) return result;
  // Some zones advance the clock at local midnight; the civil date still
  // exists, so use its first representable minute rather than another day.
  for (let instant = targetUtc - 36 * 60 * 60 * 1000; instant <= targetUtc + 36 * 60 * 60 * 1000; instant += 60 * 1000) {
    const fallback = new Date(instant);
    if (paidAtToReceivedOn(fallback, normalized) === dateOnly) return fallback;
  }
  throw new Error("PAYMENT_DATE_INVALID");
}

type CanonicalIntent = { amount: Prisma.Decimal; method: string; reference: string | null; notes: string | null };

/**
 * A reused key repeats the same logical payment only when the canonical
 * intent matches: rounded amount, method, reference, notes, and — when the
 * caller stated one — the Received-on day. An omitted date never conflicts:
 * a retry sent on a later day without a date still means the original receipt.
 */
function idempotencyConflict(
  previous: { amount: Prisma.Decimal | string | number; method: string; reference: string | null; notes: string | null; paidAt: Date },
  intent: CanonicalIntent,
  receivedOn: string | null,
  timeZone: string,
): boolean {
  if (!new Prisma.Decimal(previous.amount).equals(intent.amount)) return true;
  if (previous.method !== intent.method) return true;
  if ((previous.reference || null) !== intent.reference) return true;
  if ((previous.notes || null) !== intent.notes) return true;
  if (receivedOn !== null && paidAtToReceivedOn(previous.paidAt, timeZone) !== receivedOn) return true;
  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;
  const rawAmount = body.amount;
  const amountText = typeof rawAmount === "number" ? String(rawAmount) : typeof rawAmount === "string" ? rawAmount.trim() : "";
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(amountText)) return NextResponse.json({ success: false, message: "Enter a valid positive payment amount." }, { status: 400 });
  const requestedAmount = new Prisma.Decimal(amountText);
  if (requestedAmount.lte(0) || requestedAmount.gt(1_000_000_000)) return NextResponse.json({ success: false, message: "Payment amount is outside the supported range." }, { status: 400 });
  const method = clean(body.method, 40) || "manual";
  const reference = clean(body.reference, 160);
  const notes = clean(body.notes, 1_000);
  const rawIdempotencyKey = req.headers.get("idempotency-key") || (typeof body.idempotency_key === "string" ? body.idempotency_key : "");
  let idempotencyKey: string | null;
  try {
    idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey || null);
  } catch (error) {
    if (error instanceof InvalidIdempotencyKeyError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    throw error;
  }
  // A malformed calendar date is rejected before any row is locked or read.
  const hasReceivedOn = Object.prototype.hasOwnProperty.call(body, "receivedOn");
  const requestedReceivedOn = body.receivedOn;
  if (hasReceivedOn && !isValidReceivedOn(requestedReceivedOn)) {
    return NextResponse.json({ success: false, message: "Received on must be a valid calendar date." }, { status: 400 });
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoices" WHERE "id" = ${id} AND "user_id" = ${session.userId} FOR UPDATE`);
      const invoice = await tx.invoice.findFirst({ where: { id, userId: session.userId }, include: { client: { select: { name: true, email: true } } } });
      if (!invoice) throw new Error("NOT_FOUND");

      const owner = await tx.user.findUnique({ where: { id: session.userId }, select: { timeZone: true } });
      const timeZone = normalizePaymentTimeZone(owner?.timeZone);
      const today = todayInTimeZone(new Date(), timeZone);
      const receivedOn = hasReceivedOn ? (requestedReceivedOn as string) : today;
      if (receivedOn > today) throw new Error("PAYMENT_DATE_FUTURE");
      const paidAt = receivedOnToInstant(receivedOn, timeZone);

      const amount = requestedAmount.toDecimalPlaces(currencyFractionDigits(invoice.currency), Prisma.Decimal.ROUND_HALF_UP);
      if (amount.lte(0)) throw new Error("PAYMENT_TOO_SMALL");

      // A settled invoice still answers for its own receipts: look the key up
      // after ownership and locking but before the status gate, so a retried
      // final payment returns its original receipt instead of a rejection.
      if (idempotencyKey) {
        const previous = await tx.invoicePayment.findUnique({ where: { invoiceId_idempotencyKey: { invoiceId: id, idempotencyKey } } });
        if (previous) {
          if (idempotencyConflict(previous, { amount, method, reference, notes }, hasReceivedOn ? receivedOn : null, timeZone)) {
            throw new Error("PAYMENT_IDEMPOTENCY_CONFLICT");
          }
          return { created: previous, duplicate: true, receivedOn: paidAtToReceivedOn(previous.paidAt, timeZone) };
        }
      }
      if (!["sent", "viewed", "overdue", "partially_paid"].includes(invoice.status)) throw new Error("PAYMENT_STATUS");
      const outstanding = invoice.total.sub(invoice.amountPaid);
      if (amount.gt(outstanding)) throw new Error("PAYMENT_EXCEEDS_OUTSTANDING");
      const nextAmountPaid = invoice.amountPaid.add(amount);
      const fullyPaid = nextAmountPaid.gte(invoice.total);
      const created = await tx.invoicePayment.create({ data: { invoiceId: id, amount, paidAt, method, reference, notes, idempotencyKey } });
      await tx.invoice.update({ where: { id }, data: { amountPaid: nextAmountPaid, status: fullyPaid ? "paid" : "partially_paid", paidDate: fullyPaid ? paidAt : null } });
      await tx.invoiceEvent.create({ data: { invoiceId: id, userId: session.userId, eventType: fullyPaid ? "paid" : "payment_recorded", metadata: { amount: amount.toString(), method, receivedOn } } });
      if (fullyPaid) {
        await enqueuePaidReceiptIfEnabled(tx, {
          invoiceId: id,
          userId: session.userId,
          invoiceNumber: invoice.invoiceNumber,
          currency: invoice.currency,
          total: invoice.total.toString(),
          paidDate: paidAt,
          clientName: invoice.client?.name || "there",
          clientEmail: invoice.client?.email || null,
          publicTokenEncrypted: invoice.publicTokenEncrypted,
        }).catch((error) => console.error("Paid receipt enqueue failed:", error));
      }
      return { created, duplicate: false, receivedOn };
    });
    if (!payment.duplicate) await recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.paymentRecorded, module: "invoices", entityType: "invoice", entityId: id, properties: { method } });
    return NextResponse.json({ success: true, paymentId: payment.created.id, duplicate: payment.duplicate, receivedOn: payment.receivedOn, message: payment.duplicate ? "Payment was already recorded." : "Payment recorded." }, { status: payment.duplicate ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
    if (message === "PAYMENT_DATE_FUTURE") return NextResponse.json({ success: false, message: "Received on cannot be in the future." }, { status: 400 });
    if (message === "PAYMENT_DATE_INVALID") return NextResponse.json({ success: false, message: "Received on must be a valid calendar date." }, { status: 400 });
    if (message === "PAYMENT_IDEMPOTENCY_CONFLICT") return NextResponse.json({ success: false, message: "This idempotency key was already used with a different payment." }, { status: 409 });
    if (message === "PAYMENT_STATUS") return NextResponse.json({ success: false, message: "Only issued invoices can receive a payment." }, { status: 409 });
    if (message === "PAYMENT_EXCEEDS_OUTSTANDING") return NextResponse.json({ success: false, message: "Payment cannot exceed the outstanding balance." }, { status: 400 });
    if (message === "PAYMENT_TOO_SMALL") return NextResponse.json({ success: false, message: "Payment is smaller than the currency's supported precision." }, { status: 400 });
    // Two requests that pass the lookup together collide on the per-invoice
    // key. The losing transaction rolls back untouched, so re-reading under
    // an ownership check returns the winner's receipt with no second payment
    // and no second event — never a 500, never a duplicate write.
    const code = (error as { code?: unknown } | null)?.code;
    if (idempotencyKey && code === "P2002") {
      try {
        const invoice = await prisma.invoice.findFirst({ where: { id, userId: session.userId } });
        if (!invoice) return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
        const previous = await prisma.invoicePayment.findUnique({ where: { invoiceId_idempotencyKey: { invoiceId: id, idempotencyKey } } });
        if (previous) {
          const owner = await prisma.user.findUnique({ where: { id: session.userId }, select: { timeZone: true } });
          const timeZone = normalizePaymentTimeZone(owner?.timeZone);
          const amount = requestedAmount.toDecimalPlaces(currencyFractionDigits(invoice.currency), Prisma.Decimal.ROUND_HALF_UP);
          const receivedOn = hasReceivedOn ? (requestedReceivedOn as string) : null;
          if (receivedOn !== null && !isValidReceivedOn(receivedOn)) {
            return NextResponse.json({ success: false, message: "Received on must be a valid calendar date." }, { status: 400 });
          }
          if (idempotencyConflict(previous, { amount, method, reference, notes }, receivedOn, timeZone)) {
            return NextResponse.json({ success: false, message: "This idempotency key was already used with a different payment." }, { status: 409 });
          }
          return NextResponse.json({ success: true, paymentId: previous.id, duplicate: true, receivedOn: paidAtToReceivedOn(previous.paidAt, timeZone), message: "Payment was already recorded." }, { status: 200 });
        }
      } catch {
        // Fall through to the generic failure below.
      }
    }
    console.error("Invoice payment error:", error);
    return NextResponse.json({ success: false, message: "Payment could not be recorded." }, { status: 500 });
  }
}
