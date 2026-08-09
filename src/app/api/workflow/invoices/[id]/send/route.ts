import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { sendInvoiceSentEmail } from "@/utils/email";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const parsedBody = await req.json().catch(() => ({}));
    const body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody) ? parsedBody as { confirm?: boolean } : {};
    if (body.confirm !== true) return NextResponse.json({ success: false, message: "Confirm the invoice after reviewing its amount, recipient, and due date." }, { status: 400 });
    await prisma.invoice.updateMany({ where: { id, userId: session.userId, status: "sending", updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } }, data: { status: "draft" } });
    const invoice = await prisma.invoice.findFirst({ where: { id, userId: session.userId }, include: { client: { select: { name: true, email: true } }, items: { orderBy: { sortOrder: "asc" } }, billingOccurrence: { include: { contract: { select: { id: true } } } } } });
    if (!invoice) return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
    if (!["draft", "overdue"].includes(invoice.status)) return NextResponse.json({ success: false, message: "Only draft or overdue invoices can be sent from this action." }, { status: 409 });
    if (!invoice.client?.email) return NextResponse.json({ success: false, message: "Add the client’s email before sending this invoice." }, { status: 400 });
    const owner = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } });
    if (!owner) return NextResponse.json({ success: false, message: "Owner not found." }, { status: 404 });

    const claimed = await prisma.invoice.updateMany({ where: { id: invoice.id, userId: session.userId, status: { in: ["draft", "overdue"] } }, data: { status: "sending", reviewedAt: new Date() } });
    if (claimed.count !== 1) return NextResponse.json({ success: false, message: "This invoice is already being sent or is no longer a draft." }, { status: 409 });

    const email = await sendInvoiceSentEmail({ to: invoice.client.email, clientName: invoice.client.name, invoiceNumber: invoice.invoiceNumber, total: invoice.total.toString(), currency: invoice.currency, dueDate: invoice.dueDate, senderName: owner.name || owner.email });
    await prisma.invoiceDelivery.create({ data: { invoiceId: invoice.id, recipient: invoice.client.email, channel: "email", status: email.sent ? "sent" : email.reason || "failed", providerMessageId: email.messageId, error: email.sent ? null : email.reason } });
    if (invoice.billingOccurrence?.contract.id) {
      await prisma.contractEvent.create({ data: { contractId: invoice.billingOccurrence.contract.id, eventType: email.sent ? "invoice_sent" : "invoice_delivery_failed", metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, reason: email.reason || null } } }).catch(() => undefined);
    }
    if (!email.sent) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: invoice.status, reviewedAt: invoice.reviewedAt } }).catch(() => undefined);
      return NextResponse.json({ success: false, delivered: false, message: email.reason === "not_configured" ? "Invoice remains a draft because email delivery is not configured." : "Invoice remains a draft because delivery failed." }, { status: 503 });
    }

    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "sent", sentAt: new Date(), reviewedAt: new Date() } });
    await recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstMeaningfulWorkflowCompleted, { invoiceId: invoice.id });
    return NextResponse.json({ success: true, delivered: true, message: "Invoice sent and delivery recorded." });
  } catch (error) {
    console.error("Invoice send error:", error);
    return NextResponse.json({ success: false, message: "Unable to send invoice." }, { status: 500 });
  }
}
