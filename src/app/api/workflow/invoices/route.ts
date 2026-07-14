import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";

// GET /api/workflow/invoices
export async function GET(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";

    const where: any = {
      userId: session.userId
    };

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { client: { name: { contains: search, mode: "insensitive" } } },
        { project: { title: { contains: search, mode: "insensitive" } } }
      ];
    }

    if (status !== "all") {
      where.status = status;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: { select: { name: true } },
        project: { select: { title: true } }
      },
      orderBy: [
        { dueDate: "asc" },
        { createdAt: "desc" }
      ]
    });

    const formattedInvoices = invoices.map((i: any) => ({
      id: i.id,
      client_id: i.clientId,
      project_id: i.projectId,
      invoice_number: i.invoiceNumber,
      status: i.status,
      currency: i.currency,
      subtotal: i.subtotal.toString(),
      tax_rate: i.taxRate.toString(),
      tax_amount: i.taxAmount.toString(),
      total: i.total.toString(),
      issue_date: i.issueDate,
      due_date: i.dueDate,
      paid_date: i.paidDate,
      notes: i.notes,
      created_at: i.createdAt,
      updated_at: i.updatedAt,
      client_name: i.client?.name || null,
      project_title: i.project?.title || null
    }));

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices
    });
  } catch (error: any) {
    console.error("Invoices fetch error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// POST /api/workflow/invoices
export async function POST(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { 
      client_id, 
      project_id, 
      invoice_number, 
      status, 
      currency, 
      tax_rate, 
      notes, 
      due_date, 
      issue_date, 
      items 
    } = await req.json();

    if (!invoice_number || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "Invoice number and line items are required." }, { status: 400 });
    }

    // Calculate subtotal and total
    let subtotal = 0;
    const computedItems = items.map((item: any, idx: number) => {
      const quantity = parseFloat(item.quantity) || 1;
      const unitPrice = parseFloat(item.unit_price) || 0;
      const amount = quantity * unitPrice;
      subtotal += amount;
      return {
        description: item.description || "line item",
        quantity,
        unitPrice,
        amount,
        sortOrder: idx
      };
    });

    const taxRate = parseFloat(tax_rate) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Use a transaction
    const invoice = await prisma.$transaction(async (tx) => {
      // Verify invoice number is unique for this user
      const existing = await tx.invoice.findUnique({
        where: {
          unique_user_invoice_number: {
            userId: session.userId,
            invoiceNumber: invoice_number
          }
        }
      });

      if (existing) {
        throw new Error(`Invoice number "${invoice_number}" is already in use.`);
      }

      // Create invoice
      const inv = await tx.invoice.create({
        data: {
          userId: session.userId,
          clientId: client_id || null,
          projectId: project_id || null,
          invoiceNumber: invoice_number,
          status: status || "draft",
          currency: currency || "USD",
          subtotal,
          taxRate,
          taxAmount,
          total,
          issueDate: issue_date ? new Date(issue_date) : new Date(),
          dueDate: due_date ? new Date(due_date) : null,
          notes: notes || null
        }
      });

      // Create line items
      const lineItems = computedItems.map(item => ({
        invoiceId: inv.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        sortOrder: item.sortOrder
      }));

      await tx.invoiceItem.createMany({
        data: lineItems
      });

      return inv;
    });

    const formattedInvoice = {
      ...invoice,
      client_id: invoice.clientId,
      project_id: invoice.projectId,
      invoice_number: invoice.invoiceNumber,
      subtotal: invoice.subtotal.toString(),
      tax_rate: invoice.taxRate.toString(),
      tax_amount: invoice.taxAmount.toString(),
      total: invoice.total.toString(),
      created_at: invoice.createdAt,
      updated_at: invoice.updatedAt
    };

    return NextResponse.json({
      success: true,
      message: "Invoice created successfully.",
      invoice: formattedInvoice
    }, { status: 201 });
  } catch (error: any) {
    console.error("Invoice create error:", error);
    return NextResponse.json({ success: false, message: error.message || "Internal server error." }, { status: 500 });
  }
}
