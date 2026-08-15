import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { renderInvoicePdf, InvoicePdfSnapshot } from "@/utils/invoicePdf";

function filename(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 80) || "invoice";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: session.userId },
    include: {
      client: { select: { name: true, company: true, address: true } },
      project: { select: { title: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });

  const [owner, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } }),
    prisma.invoiceProfile.findUnique({ where: { userId: session.userId } }),
  ]);
  if (!owner) return NextResponse.json({ success: false, message: "Workspace owner not found." }, { status: 404 });

  const snapshot = invoice.sentSnapshot && typeof invoice.sentSnapshot === "object" && !Array.isArray(invoice.sentSnapshot)
    ? invoice.sentSnapshot as unknown as InvoicePdfSnapshot
    : {
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
      client: { name: invoice.client?.name || "Client", company: invoice.client?.company || null, address: invoice.client?.address || null },
      projectTitle: invoice.project?.title || null,
      items: invoice.items.map((item) => ({ description: item.description, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString(), amount: item.amount.toString() })),
      sender: {
        name: profile?.businessName || owner.name || owner.email,
        contactName: profile?.contactName || owner.name || null,
        email: profile?.email || owner.email,
        phone: profile?.phone || null,
        address: profile?.address || null,
        taxId: profile?.taxId || null,
        logoUrl: profile?.logoUrl || null,
        paymentInstructions: profile?.paymentInstructions || null,
        defaultTerms: profile?.defaultTerms || null,
      },
    } satisfies InvoicePdfSnapshot;

  const pdf = await renderInvoicePdf(snapshot);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename(snapshot.invoiceNumber)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
