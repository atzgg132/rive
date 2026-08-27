import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

/**
 * A single invoice with everything the workspace detail panel needs.
 *
 * The list endpoint's `?id=` parameter used to stand in for this: it returned a
 * one-row collection, which made "open this invoice" indistinguishable from
 * "filter the table down to it". Selection and filtering are different
 * operations and now have different endpoints.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({
      // Scoped by userId as well as id so a guessed identifier from another
      // workspace resolves to a 404 rather than someone else's billing record.
      where: { id, userId: session.userId },
      select: {
        id: true,
        clientId: true,
        projectId: true,
        invoiceNumber: true,
        status: true,
        currency: true,
        subtotal: true,
        discountRate: true,
        discountAmount: true,
        taxRate: true,
        taxAmount: true,
        total: true,
        amountPaid: true,
        issueDate: true,
        dueDate: true,
        paidDate: true,
        sentAt: true,
        viewedAt: true,
        voidedAt: true,
        notes: true,
        createdAt: true,
        client: { select: { id: true, name: true, company: true, email: true } },
        project: { select: { id: true, title: true } },
        billingOccurrence: { select: { contract: { select: { id: true, title: true } } } },
        items: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, description: true, quantity: true, unitPrice: true, amount: true },
        },
        payments: {
          orderBy: { paidAt: "desc" },
          select: { id: true, amount: true, method: true, reference: true, notes: true, paidAt: true },
        },
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, recipient: true, error: true, createdAt: true },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, eventType: true, metadata: true, createdAt: true },
        },
      },
    });

    if (!invoice) return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });

    const total = Number(invoice.total);
    const amountPaid = Number(invoice.amountPaid);
    const contract = invoice.billingOccurrence?.contract || null;

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        client_id: invoice.clientId,
        project_id: invoice.projectId,
        invoice_number: invoice.invoiceNumber,
        status: invoice.status,
        currency: invoice.currency,
        subtotal: invoice.subtotal.toString(),
        discount_rate: invoice.discountRate.toString(),
        discount_amount: invoice.discountAmount.toString(),
        tax_rate: invoice.taxRate.toString(),
        tax_amount: invoice.taxAmount.toString(),
        total: invoice.total.toString(),
        amount_paid: invoice.amountPaid.toString(),
        // Derived here rather than in the client so the panel, the table, and
        // the payment endpoint all agree on what is still owed.
        outstanding: Math.max(0, total - amountPaid).toFixed(2),
        issue_date: invoice.issueDate,
        due_date: invoice.dueDate,
        paid_date: invoice.paidDate,
        sent_at: invoice.sentAt,
        viewed_at: invoice.viewedAt,
        voided_at: invoice.voidedAt,
        notes: invoice.notes,
        created_at: invoice.createdAt,
        client_name: invoice.client?.name || null,
        client_company: invoice.client?.company || null,
        client_email: invoice.client?.email || null,
        project_title: invoice.project?.title || null,
        contract_id: contract?.id || null,
        contract_title: contract?.title || null,
        items: invoice.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity.toString(),
          unit_price: item.unitPrice.toString(),
          amount: item.amount.toString(),
        })),
        payments: invoice.payments.map((payment) => ({
          id: payment.id,
          amount: payment.amount.toString(),
          method: payment.method,
          reference: payment.reference,
          notes: payment.notes,
          paid_at: payment.paidAt,
        })),
        latest_delivery: invoice.deliveries[0] ? {
          status: invoice.deliveries[0].status,
          recipient: invoice.deliveries[0].recipient,
          error: invoice.deliveries[0].error,
          created_at: invoice.deliveries[0].createdAt,
        } : null,
        events: invoice.events.map((event) => ({
          id: event.id,
          event_type: event.eventType,
          metadata: event.metadata,
          created_at: event.createdAt,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Invoice detail fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
