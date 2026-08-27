import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { buildInvoiceSentEmail, getEmailProvider } from "@/utils/email";
import { enqueueEmail, processEmailOutbox } from "@/utils/emailOutbox";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";
import { PRODUCT_EVENTS, recordProductEvent } from "@/utils/productEvents";
import { createInvoicePublicToken, hashInvoicePublicToken, invoicePublicUrl } from "@/utils/invoicePublic";
import { reclaimStaleSendingInvoice } from "@/utils/invoiceSend";
import { renderInvoicePdf } from "@/utils/invoicePdf";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const { id } = await params;
    const parsedBody = await req.json().catch(() => ({}));
    const body = parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody) ? parsedBody as { confirm?: boolean } : {};
    if (body.confirm !== true) return NextResponse.json({ success: false, message: "Confirm the invoice after reviewing its amount, recipient, and due date." }, { status: 400 });

    await reclaimStaleSendingInvoice(id, session.userId);
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
    const client = invoice.client;
    const clientEmail = client?.email;
    if (!client || !clientEmail) return NextResponse.json({ success: false, message: "Add the client's email before sending this invoice." }, { status: 400 });

    const [owner, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } }).catch(() => null),
      prisma.invoiceProfile.findUnique({ where: { userId: session.userId } }),
    ]);
    if (!owner) return NextResponse.json({ success: false, message: "Owner not found." }, { status: 404 });

    const token = createInvoicePublicToken();
    const tokenHash = hashInvoicePublicToken(token);
    const claimResult = await prisma.invoice.updateMany({
      where: {
        id: invoice.id,
        userId: session.userId,
        status: invoice.status,
        updatedAt: invoice.updatedAt,
      },
      data: { status: "sending", publicTokenHash: tokenHash },
    });
    if (claimResult.count !== 1) return NextResponse.json({ success: false, message: "This invoice is already being sent or is no longer a draft." }, { status: 409 });

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
      client: { name: client.name, company: client.company || null, address: client.address || null },
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
      await prisma.invoice.updateMany({ where: { id: invoice.id, userId: session.userId, status: "sending", publicTokenHash: tokenHash }, data: { status: invoice.status, publicTokenHash: null, sentSnapshot: Prisma.JsonNull, sentSnapshotAt: null } }).catch(() => undefined);
      throw error;
    }

    let outboxId = "";
    await prisma.$transaction(async (tx) => {
      const issuedAt = new Date();
      const issued = await tx.invoice.updateMany({
        where: { id: invoice.id, userId: session.userId, status: "sending", publicTokenHash: tokenHash },
        data: {
          status: "sent",
          sentAt: issuedAt,
          reviewedAt: issuedAt,
          publicTokenHash: tokenHash,
          sentSnapshot: snapshot,
          sentSnapshotAt: issuedAt,
        },
      });
      if (issued.count !== 1) throw new Error("The invoice send claim was lost before issuance.");
      await tx.invoiceEvent.create({ data: { invoiceId: invoice.id, userId: session.userId, eventType: "send_started", metadata: { channel: "email" } } });
      outboxId = await enqueueEmail({
        ...buildInvoiceSentEmail({
          to: clientEmail,
          clientName: client.name,
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total.sub(invoice.amountPaid).toString(),
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          senderName,
          publicUrl,
        }),
        deliveryGuard: { kind: "invoice_sent", invoiceId: id, tokenHash },
      }, tx);
      await tx.invoiceDelivery.create({
        data: {
          id: outboxId,
          invoiceId: invoice.id,
          recipient: clientEmail,
          channel: "email",
          status: "queued",
          providerMessageId: null,
          error: "queued_for_retry",
        },
      });
      await tx.invoiceEvent.create({ data: { invoiceId: invoice.id, userId: session.userId, eventType: "sent", metadata: { channel: "email" } } });
      if (invoice.billingOccurrence?.contract.id) {
        await tx.contractEvent.create({ data: { contractId: invoice.billingOccurrence.contract.id, eventType: "invoice_sent", metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber } } });
      }
    });

    let delivered = false;
    if (getEmailProvider() !== "disabled") {
      const outbox = await processEmailOutbox({ jobId: outboxId }).catch((deliveryError) => {
        console.error("Immediate invoice delivery attempt failed:", deliveryError);
        return null;
      });
      delivered = Boolean(outbox && outbox.sent > 0);
    }
    await recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstMeaningfulWorkflowCompleted, { invoiceId: invoice.id }).catch((eventError) => console.error("Invoice activation event failed:", eventError));
    await recordProductEvent({ userId: session.userId, eventName: PRODUCT_EVENTS.invoiceSent, module: "invoices", entityType: "invoice", entityId: invoice.id, dataOrigin: invoice.dataOrigin || "user" }).catch((eventError) => console.error("Invoice product event failed:", eventError));
    return NextResponse.json({
      success: true,
      delivered,
      publicUrl,
      message: delivered
        ? "Invoice sent and delivery recorded."
        : "Invoice is issued. Share the public link if email delivery is still pending.",
    });
  } catch (error) {
    console.error("Invoice send error:", error);
    return NextResponse.json({ success: false, message: "Unable to send invoice." }, { status: 500 });
  }
}
