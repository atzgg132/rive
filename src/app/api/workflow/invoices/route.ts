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
        project: { select: { title: true } },
        items: {
          orderBy: { sortOrder: 'asc' }
        }
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
      project_title: i.project?.title || null,
      items: (i.items || []).map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unitPrice.toString(),
        amount: item.amount.toString()
      }))
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
      const lineItems = computedItems.map((item: any) => ({
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

    return NextResponse.json({
      success: true,
      message: "Invoice created successfully.",
      invoice
    }, { status: 201 });
  } catch (error: any) {
    console.error("Invoice create error:", error);
    return NextResponse.json({ success: false, message: error.message || "Internal server error." }, { status: 500 });
  }
}

// PUT /api/workflow/invoices
export async function PUT(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { 
      id,
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

    if (!id) {
      return NextResponse.json({ success: false, message: "Invoice ID is required." }, { status: 400 });
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id }
    });

    if (!existingInvoice || existingInvoice.userId !== session.userId) {
      return NextResponse.json({ success: false, message: "Invoice not found or unauthorized." }, { status: 404 });
    }

    const dataToUpdate: any = {
      clientId: client_id !== undefined ? (client_id || null) : existingInvoice.clientId,
      projectId: project_id !== undefined ? (project_id || null) : existingInvoice.projectId,
      invoiceNumber: invoice_number !== undefined ? invoice_number : existingInvoice.invoiceNumber,
      status: status !== undefined ? status : existingInvoice.status,
      currency: currency !== undefined ? currency : existingInvoice.currency,
      taxRate: tax_rate !== undefined ? parseFloat(tax_rate) : existingInvoice.taxRate,
      notes: notes !== undefined ? notes : existingInvoice.notes,
      issueDate: issue_date !== undefined ? (issue_date ? new Date(issue_date) : existingInvoice.issueDate) : existingInvoice.issueDate,
      dueDate: due_date !== undefined ? (due_date ? new Date(due_date) : null) : existingInvoice.dueDate,
    };

    if (status === "paid" && existingInvoice.status !== "paid") {
       dataToUpdate.paidDate = new Date();
    } else if (status !== undefined && status !== "paid") {
       dataToUpdate.paidDate = null;
    }

    await prisma.$transaction(async (tx) => {
      if (dataToUpdate.invoiceNumber && dataToUpdate.invoiceNumber !== existingInvoice.invoiceNumber) {
        const existing = await tx.invoice.findUnique({
          where: {
            unique_user_invoice_number: {
              userId: session.userId,
              invoiceNumber: dataToUpdate.invoiceNumber
            }
          }
        });

        if (existing) {
          throw new Error(`Invoice number "${dataToUpdate.invoiceNumber}" is already in use.`);
        }
      }

      if (items && Array.isArray(items) && items.length > 0) {
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
        const taxRateToUse = dataToUpdate.taxRate || 0;
        const taxAmount = subtotal * (taxRateToUse / 100);
        const total = subtotal + taxAmount;
        
        dataToUpdate.subtotal = subtotal;
        dataToUpdate.taxAmount = taxAmount;
        dataToUpdate.total = total;

        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        
        await tx.invoice.update({
          where: { id },
          data: dataToUpdate
        });
        
        const lineItems = computedItems.map((item: any) => ({
          invoiceId: id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          sortOrder: item.sortOrder
        }));
        
        await tx.invoiceItem.createMany({
          data: lineItems
        });
      } else {
        await tx.invoice.update({
          where: { id },
          data: dataToUpdate
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Invoice updated successfully."
    });
  } catch (error: any) {
    console.error("Invoice update error:", error);
    return NextResponse.json({ success: false, message: error.message || "Internal server error." }, { status: 500 });
  }
}

// DELETE /api/workflow/invoices
export async function DELETE(req: NextRequest) {
  try {
    const session = getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Invoice ID is required." }, { status: 400 });
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id }
    });

    if (!existingInvoice || existingInvoice.userId !== session.userId) {
      return NextResponse.json({ success: false, message: "Invoice not found or unauthorized." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    return NextResponse.json({
      success: true,
      message: "Invoice deleted successfully."
    });
  } catch (error: any) {
    console.error("Invoice delete error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
