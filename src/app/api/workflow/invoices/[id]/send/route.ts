import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { sendInvoiceSentEmail } from "@/utils/email";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { createInvoicePublicToken, hashInvoicePublicToken, invoicePublicUrl } from "@/utils/invoicePublic";
import { renderInvoicePdf } from "@/utils/invoicePdf";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const parsedBody = await req.json().catch(() => ({}));
    const body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody) ? parsedBody as { confirm?: boolean } : {};
    if (body.confirm !== true) return NextResponse.json({ success: false, message: "Confirm the invoice after reviewing its amount, recipient, and due date." }, { status: 400 });

    await prisma.invoice.updateMany({
      where: { id, userId: session.userId, status: "sending", updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
      data: { status: "draft", publicTokenHash: null, sentSnapshot: Prisma.JsonNull, sentSnapshotAt: null },
    });
    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: session.userId },
      include: {
        client: { select: { name: true, email: true, company: true, address: true } },
        project: { select: { title: true } },
        items: { orderBy: { sortOrder: "asc" } },
        billingOccurrence: { include: { contract: { select: { id: true } } } },
      },
    });
    if (!invoice) return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
    if (!["draft", "overdue"].includes(invoice.status)) return NextResponse.json({ success: false, message: "Only draft or overdue invoices can be sent from this action." }, { status: 409 });
    if (!invoice.client?.email) return NextResponse.json({ success: false, message: "Add the client's email before sending this invoice." }, { status: 400 });

    const [owner, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } }).catch(() => null),
      prisma.invoiceProfile.findUnique({ where: { userId: session.userId } }),
    ]);
    if (!owner) return NextResponse.json({ success: false, message: "Owner not found." }, { status: 404 });

    const claimResult = await prisma.invoice.updateMany({ where: { id: invoice.id, userId: session.userId, status: { in: ["draft", "overdue"] } }, data: { status: "sending", reviewedAt: new Date() } });
    if (claimResult.count !== 1) return NextResponse.json({ success: false, message: "This invoice is already being sent or is no longer a draft." }, { status: 409 });

    const token = createInvoicePublicToken();
    const publicUrl = invoicePublicUrl(token);
    const senderName = profile?.businessName || owner.name || owner.email;
    const snapshot = {
      version: 2,
      invoiceNumber: invoice.invoiceNumber,
      currency: invoice.currency,
      subtotal: invoice.subtotal.toString(),
      discountRate: invoice.discountRate.toString(),
      discountAmount: invoice.discountAmount.toString(),
      taxRate: invoice.taxRate.toString(),
      taxAmount: invoice.taxAmount.toString(),
      total: invoice.total.toString(),
      amountPaid: invoice.amountPaid.toString(),
      outstanding: invoice.total.sub(invoice.amountPaid).toString(),
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate?.toISOString() || null,
      notes: invoice.notes,
      client: { name: invoice.client.name, company: invoice.client.company || null, address: invoice.client.address || null },
      projectTitle: invoice.project?.title || null,
      items: invoice.items.map((item) => ({ description: item.description, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString(), amount: item.amount.toString() })),
      sender: {
        name: senderName,
        contactName: profile?.contactName || owner.name || null,
        email: profile?.email || owner.email,
        phone: profile?.phone || null,
        address: profile?.address || null,
        taxId: profile?.taxId || null,
        logoUrl: profile?.logoUrl || null,
        paymentInstructions: profile?.paymentInstructions || null,
        defaultTerms: profile?.defaultTerms || null,
      },
    };

    // Generate the exact client-facing artifact before delivery is attempted.
    // The immutable sent snapshot is the source of truth used by both owner and
    // public PDF routes, so a later draft edit cannot change the delivered file.
    try {
      await renderInvoicePdf(snapshot);
    } catch (error) {
      await prisma.invoice.updateMany({ where: { id: invoice.id, userId: session.userId, status: "sending" }, data: { status: invoice.status, publicTokenHash: null, sentSnapshot: Prisma.JsonNull, sentSnapshotAt: null } }).catch(() => undefined);
      throw error;
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { publicTokenHash: hashInvoicePublicToken(token), sentSnapshot: snapshot, sentSnapshotAt: new Date() },
      });
      await tx.invoiceEvent.create({ data: { invoiceId: invoice.id, userId: session.userId, eventType: "send_started", metadata: { channel: "email" } } });
    });

    const email = await sendInvoiceSentEmail({
      to: invoice.client.email,
      clientName: invoice.client.name,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total.sub(invoice.amountPaid).toString(),
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      senderName,
      publicUrl,
    });
    await prisma.invoiceDelivery.create({ data: { invoiceId: invoice.id, recipient: invoice.client.email, channel: "email", status: email.sent ? "sent" : email.reason || "failed", providerMessageId: email.messageId, error: email.sent ? null : email.reason } });

    if (!email.sent) {
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status: invoice.status, publicTokenHash: null, sentSnapshot: Prisma.JsonNull, sentSnapshotAt: null } });
        await tx.invoiceEvent.create({ data: { invoiceId: invoice.id, userId: session.userId, eventType: "delivery_failed", metadata: { reason: email.reason || "delivery_failed" } } });
      }).catch(() => undefined);
      return NextResponse.json({ success: false, delivered: false, message: email.reason === "not_configured" ? "Invoice remains a draft because email delivery is not configured." : "Invoice remains a draft because delivery failed." }, { status: 503 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: "sent", sentAt: new Date(), reviewedAt: new Date() } });
      await tx.invoiceEvent.create({ data: { invoiceId: invoice.id, userId: session.userId, eventType: "sent", metadata: { channel: "email" } } });
      if (invoice.billingOccurrence?.contract.id) {
        await tx.contractEvent.create({ data: { contractId: invoice.billingOccurrence.contract.id, eventType: "invoice_sent", metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber } } });
      }
    });
    await recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstMeaningfulWorkflowCompleted, { invoiceId: invoice.id });
    await recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.invoiceSent, module: "invoices", entityType: "invoice", entityId: invoice.id, dataOrigin: invoice.dataOrigin || "user" });
    return NextResponse.json({ success: true, delivered: true, publicUrl, message: "Invoice sent and delivery recorded." });
  } catch (error) {
    console.error("Invoice send error:", error);
    return NextResponse.json({ success: false, message: "Unable to send invoice." }, { status: 500 });
  }
}
